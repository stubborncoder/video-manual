"""CLI entry point for running the API server."""

import logging
import sys

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


def main():
    """Run the API server with uvicorn."""
    import uvicorn

    # Parse simple CLI args
    host = "0.0.0.0"
    port = 8000
    reload = False

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] in ("--host", "-h") and i + 1 < len(args):
            host = args[i + 1]
            i += 2
        elif args[i] in ("--port", "-p") and i + 1 < len(args):
            port = int(args[i + 1])
            i += 2
        elif args[i] in ("--reload", "-r"):
            reload = True
            i += 1
        elif args[i] in ("--help",):
            print("vDocs API Server")
            print()
            print("Usage: vdocs-api [options]")
            print()
            print("Options:")
            print("  --host, -h HOST    Host to bind to (default: 0.0.0.0)")
            print("  --port, -p PORT    Port to bind to (default: 8000)")
            print("  --reload, -r       Enable auto-reload for development")
            print("  --help             Show this help message")
            return
        else:
            i += 1

    print(f"Starting vDocs API server on {host}:{port}")
    print(f"API docs available at http://{host}:{port}/docs")
    print()

    uvicorn.run(
        "src.api.main:app",
        host=host,
        port=port,
        reload=reload,
    )


if __name__ == "__main__":
    main()
