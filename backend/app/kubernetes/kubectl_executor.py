import subprocess
import json
from typing import Tuple, List, Optional, Any
from loguru import logger

class KubectlExecutor:
    @staticmethod
    def run_command(args: List[str], context: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        Executes a kubectl command with the provided args.
        Returns: (success, stdout, stderr)
        """
        cmd = ["kubectl"]
        if context:
            cmd += ["--context", context]
        cmd += args
        logger.debug(f"Executing: {' '.join(cmd)}")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
                timeout=30
            )
            success = result.returncode == 0
            return success, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            logger.error(f"Command timed out: {' '.join(cmd)}")
            return False, "", "Command execution timed out after 30 seconds."
        except FileNotFoundError:
            logger.error("kubectl executable not found in PATH.")
            return False, "", "kubectl executable not found. Make sure kubectl is installed and configured in system PATH."
        except Exception as e:
            logger.exception(f"Unexpected error running command: {' '.join(cmd)}")
            return False, "", str(e)

    @classmethod
    def run_json_command(cls, args: List[str], context: Optional[str] = None) -> Tuple[bool, Optional[Any], str]:
        """
        Executes a kubectl command and parses the output as JSON.
        Returns: (success, parsed_json_dict_or_list, error_message)
        """
        # Ensure json format option is appended
        if "-o" not in args:
            args = args + ["-o", "json"]
        elif "json" not in args:
            # -o is present, ensure json format
            idx = args.index("-o")
            if idx + 1 < len(args):
                args[idx + 1] = "json"
            else:
                args.append("json")

        success, stdout, stderr = cls.run_command(args, context=context)
        if not success:
            return False, None, stderr

        if not stdout.strip():
            return True, None, ""

        try:
            data = json.loads(stdout)
            return True, data, ""
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON output from command: {' '.join(args)}. Error: {e}")
            return False, None, f"Failed to parse JSON output: {str(e)}"
