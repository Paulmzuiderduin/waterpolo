#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
SCRIPT_PATH="$SCRIPT_DIR/dog_invoice_importer.py"

clear
echo "Running dog invoice importer..."
echo

"$PYTHON_BIN" "$SCRIPT_PATH"
status=$?

echo
if [ "$status" -eq 0 ]; then
  echo "Import finished successfully."
else
  echo "Import finished with an error (exit code $status)."
fi
echo
read -r "?Press Enter to close..."
exit "$status"
