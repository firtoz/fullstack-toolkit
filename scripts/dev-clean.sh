#!/usr/bin/env bash
set -euo pipefail

PORTS=(5173 5174 5175 5176 5177 5197 5198 8787 8791 9229 9230)

pids=""
for port in "${PORTS[@]}"; do
	if lsof_output="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null)"; then
		if [ -n "$lsof_output" ]; then
			pids+="$lsof_output"$'\n'
		fi
	fi
done

unique_pids="$(printf "%s" "$pids" | rg '^[0-9]+$' | sort -u || true)"

if [ -z "$unique_pids" ]; then
	echo "No stale dev listeners found."
	exit 0
fi

echo "Stopping stale dev listeners:"
printf "%s\n" "$unique_pids"
kill $unique_pids || true
sleep 1

remaining=""
for port in "${PORTS[@]}"; do
	if left="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null)"; then
		if [ -n "$left" ]; then
			remaining+="$left"$'\n'
		fi
	fi
done

remaining_unique="$(printf "%s" "$remaining" | rg '^[0-9]+$' | sort -u || true)"
if [ -n "$remaining_unique" ]; then
	echo "Force killing remaining listeners:"
	printf "%s\n" "$remaining_unique"
	kill -9 $remaining_unique || true
fi

echo "Dev ports are clear."
