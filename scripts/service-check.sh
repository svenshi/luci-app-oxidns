#!/bin/sh

set -eu

REPO_DIR="$PWD"
SERVICE_TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oxidns-service-check.XXXXXX")"
cleanup_service_test() {
	test_rc="$?"
	if [ "$test_rc" -ne 0 ]; then
		for diagnostic in result error events; do
			[ ! -f "$SERVICE_TEST_DIR/$diagnostic" ] || cat "$SERVICE_TEST_DIR/$diagnostic" >&2
		done
	fi
	rm -rf "$SERVICE_TEST_DIR"
}
trap cleanup_service_test EXIT
trap 'exit 1' HUP INT TERM
export REPO_DIR SERVICE_TEST_DIR
mkdir "$SERVICE_TEST_DIR/bin"

# Model procd retaining the old instance until several state queries have passed.
# sleep advances a fake clock so timeout tests do not wait ten real seconds.
cat > "$SERVICE_TEST_DIR/bin/ubus" <<'EOF'
#!/bin/sh
set -eu
[ "$*" = '-t 2 call service list {"name":"oxidns"}' ]
printf 'query\n' >> "$SERVICE_TEST_DIR/events"
case "$SERVICE_TEST_CASE" in
	query_failed) exit 1 ;;
	invalid_json) printf 'not JSON\n'; exit 0 ;;
	invalid_root) printf '[]\n'; exit 0 ;;
	invalid_shape) printf '{"oxidns":{"instances":null}}\n'; exit 0 ;;
	empty_service) printf '{"oxidns":{}}\n'; rm -f "$SERVICE_TEST_DIR/instance"; exit 0 ;;
	empty_instances) printf '{"oxidns":{"instances":{}}}\n'; rm -f "$SERVICE_TEST_DIR/instance"; exit 0 ;;
esac
query_count="$(cat "$SERVICE_TEST_DIR/query-count")"
query_count=$((query_count + 1))
printf '%s\n' "$query_count" > "$SERVICE_TEST_DIR/query-count"
if [ ! -f "$SERVICE_TEST_DIR/instance" ]; then
	printf '{}\n'
elif [ "$SERVICE_TEST_CASE" = timeout ] || [ "$query_count" -eq 1 ]; then
	printf '{"oxidns":{"instances":{"instance1":{"running":false},"instance2":{"running":true}}}}\n'
elif [ "$query_count" -eq 2 ]; then
	# running:false must not be mistaken for an instance that has been removed.
	printf '{"oxidns":{"instances":{"instance1":{"running":false}}}}\n'
else
	rm -f "$SERVICE_TEST_DIR/instance"
	printf '{}\n'
fi
EOF

# Minimal jsonfilter double for these service-list queries, including no-match
# exit status. Use a real jsonfilter when one is available on the test host.
if command -v jsonfilter >/dev/null 2>&1; then
	ln -s "$(command -v jsonfilter)" "$SERVICE_TEST_DIR/bin/jsonfilter"
else
	cat > "$SERVICE_TEST_DIR/bin/jsonfilter" <<'EOF'
#!/usr/bin/env node
const fs = require('fs');
try {
	const value = JSON.parse(fs.readFileSync(0, 'utf8'));
	const expression = process.argv[3];
	let matches;
	switch (expression) {
		case '@': matches = [value]; break;
		case '@.oxidns': matches = [value?.oxidns]; break;
		case '@.oxidns.instances': matches = [value?.oxidns?.instances]; break;
		case '@.oxidns.instances[*]':
			matches = Object.values(value?.oxidns?.instances || {}); break;
		default:
			if (!/^@\.[a-z_]+$/.test(expression))
				throw new Error('Unexpected query: ' + expression);
			matches = [value?.[expression.slice(2)]];
	}
	matches = matches.filter(v => v !== undefined);
	if (!matches.length) process.exit(1);
	for (const match of matches) {
		if (process.argv[2] === '-t')
			console.log(match === null ? 'null' : Array.isArray(match) ? 'array' : typeof match);
		else if (match !== null)
			console.log(typeof match === 'string' ? match : JSON.stringify(match));
	}
} catch (error) {
	console.error(error.message);
	process.exit(1);
}
EOF
fi
cat > "$SERVICE_TEST_DIR/bin/sleep" <<'EOF'
#!/bin/sh
set -eu
[ "$1" = 1 ]
printf 'wait\n' >> "$SERVICE_TEST_DIR/events"
clock_value="$(cat "$SERVICE_TEST_DIR/clock")"
printf '%s\n' "$((clock_value + 1))" > "$SERVICE_TEST_DIR/clock"
EOF
cat > "$SERVICE_TEST_DIR/bin/date" <<'EOF'
#!/bin/sh
set -eu
[ "$1" = '+%s' ]
cat "$SERVICE_TEST_DIR/clock"
EOF
cat > "$SERVICE_TEST_DIR/bin/logger" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "$SERVICE_TEST_DIR/audit"
EOF

cat > "$SERVICE_TEST_DIR/init" <<'EOF'
#!/bin/sh
set -eu
printf '%s\n' "$1" >> "$SERVICE_TEST_DIR/events"
case "$1" in
	stop)
		[ "$SERVICE_TEST_CASE" != stop_failed ] || exit 1
		;;
	start)
		# An early start would reuse the old instance and its log destination.
		[ ! -f "$SERVICE_TEST_DIR/instance" ] || exit 1
		[ "$SERVICE_TEST_CASE" != start_failed ] || exit 1
		config_load() { :; }
		config_get() {
			case "$1" in
				CONFIG_PATH) CONFIG_PATH="$SERVICE_TEST_DIR/config.yaml" ;;
				WORKING_DIR) WORKING_DIR="$SERVICE_TEST_DIR/work" ;;
			esac
		}
		config_get_bool() { LOG_SYSLOG="$SERVICE_TEST_LOG_SYSLOG"; }
		procd_open_instance() { :; }
		procd_close_instance() { :; }
		procd_set_param() { printf '%s\n' "$*" >> "$SERVICE_TEST_DIR/procd-args"; }
		. "$REPO_DIR/root/etc/init.d/oxidns"
		PROG="$SERVICE_TEST_DIR/oxidns"
		start_service
		;;
	*) exit 1 ;;
esac
EOF
printf '#!/bin/sh\nexit 0\n' > "$SERVICE_TEST_DIR/oxidns"
chmod 755 "$SERVICE_TEST_DIR/init" "$SERVICE_TEST_DIR/oxidns" "$SERVICE_TEST_DIR/bin/"*

# Source the real rpcd backend without dispatching a mutation, then only
# redirect its system paths/validation to fixtures. Exercise real callers.
cat > "$SERVICE_TEST_DIR/drive.sh" <<'EOF'
#!/bin/sh
set -eu
test_mode="$1"
set -- list
. "$REPO_DIR/root/usr/libexec/rpcd/luci.oxidns" >/dev/null
OXIDNS_BIN="$SERVICE_TEST_DIR/oxidns"
TMP_ROOT="$SERVICE_TEST_DIR"
init_script() { printf '%s\n' "$SERVICE_TEST_DIR/init"; }
load_settings() {
	CONFIG_PATH="$SERVICE_TEST_DIR/config.yaml"
	WORKING_DIR="$SERVICE_TEST_DIR/work"
}
validate_config_file() { printf 'configuration is valid\n'; }
core_progress_command() { :; }
core_progress_log() { :; }
service_running() { return 0; }
WEBUI_DIR="$SERVICE_TEST_DIR/webui"
case "$test_mode" in
	restart|stop) run_service "$test_mode" ;;
	config)
		# Avoid the config backup's unrelated timestamp call in this test.
		rm -f "$SERVICE_TEST_DIR/config.yaml"
		emit_config_save
		;;
	upload)
		load_settings
		CORE_TMP_DIR="$(mktemp -d "$TMP_ROOT/upload.XXXXXX")"
		UPLOAD_PATH="$CORE_TMP_DIR/input"
		mkdir "$CORE_TMP_DIR/unpack"
		cp "$OXIDNS_BIN" "$CORE_TMP_DIR/unpack/oxidns"
		printf '# replacement\n' >> "$CORE_TMP_DIR/unpack/oxidns"
		validate_uploaded_binary() { return 0; }
		install_uploaded_core_from_unpack binary "$CORE_TMP_DIR/unpack"
		;;
	release)
		load_settings
		mkdir -p "$SERVICE_TEST_DIR/release"
		cp "$OXIDNS_BIN" "$SERVICE_TEST_DIR/release/oxidns"
		printf '# replacement\n' >> "$SERVICE_TEST_DIR/release/oxidns"
		tar -czf "$SERVICE_TEST_DIR/release.tar.gz" -C "$SERVICE_TEST_DIR/release" oxidns
		require_download_transport() { return 0; }
		download_file() {
			if [ "$1" = 'fixture://archive' ]; then
				cp "$SERVICE_TEST_DIR/release.tar.gz" "$2"
			else
				printf '{}\n' > "$2"
			fi
		}
		select_release_asset() {
			SELECT_TAG=v0.1.0
			SELECT_ASSET_NAME=fixture.tar.gz
			SELECT_URL=fixture://archive
			SELECT_SHA256="$(sha256_file "$SERVICE_TEST_DIR/release.tar.gz")"
		}
		install_core_from_release reinstall v0.1.0 full
		;;
esac
EOF

export PATH="$SERVICE_TEST_DIR/bin:$PATH"
reset_service_case() {
	SERVICE_TEST_CASE="$1"
	SERVICE_TEST_LOG_SYSLOG="$2"
	export SERVICE_TEST_CASE SERVICE_TEST_LOG_SYSLOG
	: > "$SERVICE_TEST_DIR/events"
	: > "$SERVICE_TEST_DIR/audit"
	: > "$SERVICE_TEST_DIR/procd-args"
	: > "$SERVICE_TEST_DIR/instance"
	: > "$SERVICE_TEST_DIR/config.yaml"
	printf '0\n' > "$SERVICE_TEST_DIR/query-count"
	printf '100\n' > "$SERVICE_TEST_DIR/clock"
}
run_service_case() {
	printf '{"content":"test: true","restart":true}' |
		/bin/sh "$SERVICE_TEST_DIR/drive.sh" "$1" > "$SERVICE_TEST_DIR/result" 2> "$SERVICE_TEST_DIR/error"
}
assert_result() {
	node -e "const v=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); if (!($1)) process.exit(1);" "$SERVICE_TEST_DIR/result"
}

for log_setting in 0 1; do
	for caller in restart config upload release; do
		reset_service_case delayed "$log_setting"
		run_service_case "$caller"
		assert_result 'v.ok === true'
		test "$(cat "$SERVICE_TEST_DIR/events")" = "$(printf 'stop\nquery\nwait\nquery\nwait\nquery\nstart')"
		grep -qx "stdout $log_setting" "$SERVICE_TEST_DIR/procd-args"
		grep -qx "stderr $log_setting" "$SERVICE_TEST_DIR/procd-args"
	done
done

for state in stopped empty_service empty_instances; do
	reset_service_case "$state" 0
	[ "$state" != stopped ] || rm "$SERVICE_TEST_DIR/instance"
	run_service_case restart
	assert_result 'v.ok === true'
	test "$(cat "$SERVICE_TEST_DIR/events")" = "$(printf 'stop\nquery\nstart')"
done

for failure in timeout query_failed invalid_json invalid_root invalid_shape stop_failed start_failed; do
	for caller in restart config upload release; do
		reset_service_case "$failure" 0
		core_before="$(cat "$SERVICE_TEST_DIR/oxidns")"
		if run_service_case "$caller"; then
			printf 'unexpected success: %s %s\n' "$failure" "$caller" >&2
			exit 1
		fi
		assert_result 'v.ok === false'
		if [ "$failure" = timeout ]; then
			assert_result "JSON.stringify(v).includes('timed out')"
			test "$(cat "$SERVICE_TEST_DIR/clock")" -eq 110
		fi
		if [ "$failure" != start_failed ]; then
			! grep -qx start "$SERVICE_TEST_DIR/events"
			test "$(cat "$SERVICE_TEST_DIR/oxidns")" = "$core_before"
		fi
		case "$caller" in
			restart)
				assert_result "v.code === 'service_failed'"
				grep -q 'service restart failed:' "$SERVICE_TEST_DIR/audit"
				;;
			config) assert_result "v.code === 'service_restart_failed'" ;;
			upload|release)
				if [ "$failure" = start_failed ]; then
					assert_result "v.code === 'service_restart_failed'"
				else
					assert_result "v.code === 'service_stop_failed'"
				fi
				;;
		esac
	done
done

reset_service_case delayed 0
run_service_case stop
assert_result 'v.ok === true'
test "$(cat "$SERVICE_TEST_DIR/events")" = "$(printf 'stop\nquery\nwait\nquery\nwait\nquery')"
printf 'Service restart checks passed\n'
