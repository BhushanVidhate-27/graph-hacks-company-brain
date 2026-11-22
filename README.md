# Helio Terminal Client

A command-line interface for interacting with the Helio company brain system.

## Overview

The Helio Terminal Client provides a CLI interface for:

- Creating accounts and workspaces
- Uploading documents (PDF, DOCX, TXT, CSV)
- Querying the company brain with real graph traversals
- Managing sessions and API keys
- Interactive terminal mode for step-by-step operations

## Features

- **Account Management**: Create accounts, login, logout
- **Document Upload**: Upload documents to the knowledge base with automatic text extraction
- **Query Interface**: Ask natural language questions about the company and get graph-based answers
- **Document Management**: List, view, and manage uploaded documents
- **Interactive Mode**: Guided, step-by-step interaction for new users
- **Non-Interactive Mode**: Use via command-line arguments for automation

## Installation

```bash
# Ensure you have Python 3.7+ installed
cd /path/to/helio
pip install -r requirements.txt
```

## Quick Start

### Interactive Mode

```bash
python scripts/terminal_client.py --interactive
```

This will start an interactive session where you can:
- Login or create an account
- Upload documents
- Query the company brain
- List documents and more

### Non-Interactive Mode

```bash
# Create an account
python scripts/terminal_client.py create-account \
  --email user@example.com \
  --name "User Name" \
  --account-name "user-account" \
  --password "secure_password"

# Login
python scripts/terminal_client.py login \
  --email user@example.com \
  --password "secure_password"

# Upload a document
python scripts/terminal_client.py upload \
  --account "acct_xxx" \
  --file document.pdf

# Query the company brain
python scripts/terminal_client.py query \
  --account "acct_xxx" \
  --question "what does the payment gateway decision say about Adyen?"

# List documents
python scripts/terminal_client.py list-docs \
  --account "acct_xxx"
```

## Usage Examples

### Create Account

```bash
python scripts/terminal_client.py \
  create-account \
  --email john.doe@company.com \
  --name "John Doe" \
  --account-name "john-account" \
  --password "J0hnP@ssw0rd"
```

### Login

```bash
python scripts/terminal_client.py \
  login \
  --email john.doe@company.com \
  --password "J0hnP@ssw0rd"
```

### Upload Document

```bash
python scripts/terminal_client.py \
  upload \
  --account "acct_xxx" \
  --file "decision.pdf"
```

### Query Company Brain

```bash
python scripts/terminal_client.py \
  query \
  --account "acct_xxx" \
  --question "who decided the payments provider?"
```

### List Documents

```bash
python scripts/terminal_client.py \
  list-docs \
  --account "acct_xxx"
```

## Command Reference

### Global Options

```
--mock              Use mock data instead of real graph (testing)
--account ID        Account ID to use (defaults to current session)
--workspace ID      Workspace ID to use
--interactive      Run in interactive mode (default: non-interactive)
```

### Commands

#### create-account
Creates a new account with an owner user.

**Options:**
- `--email`: User's email address
- `--name`: User's full name
- `--account-name`: Name for the account
- `--password`: User's password

#### login
Logs into an existing account.

**Options:**
- `--email`: User's email address
- `--password`: User's password

#### upload
Uploads a document to the knowledge base.

**Options:**
- `--account ID`: Account ID to upload to
- `--file PATH`: Path to the document file (PDF, DOCX, TXT, CSV)

#### query
Queries the company brain with a question.

**Options:**
- `--account ID`: Account ID to query
- `--question TEXT`: The question to ask

#### list-docs
Lists documents in the knowledge base.

**Options:**
- `--account ID`: Account ID to list documents for
- `--limit N`: Maximum number of documents to return (default: 10)

### Error Handling

The terminal client provides clear error messages for:
- Invalid credentials
- File upload errors (unsupported format, too large)
- Network issues
- Database connection problems

### Dependencies

- Python 3.7+
- FastAPI
- FalkorDB
- PostgreSQL/SQLite (depending on configuration)
- PyPDF2
- python-docx
- questionary (for interactive mode)

### Environment Variables

The client reads from `.env` file (same as the rest of the Helio system):

- `USE_MOCK`: Use mock data instead of real graph (default: `1`)
- `DATABASE_URL`: PostgreSQL connection string
- `HELIO_DB_PATH`: SQLite database path
- `FALKORDB_HOST`: FalkorDB host
- `FALKORDB_PORT`: FalkorDB port
- `FALKORDB_SSL`: Whether to use SSL for FalkorDB connection

## Development

### Adding New Commands

1. Add the command handling to the `handle_command` method in `TerminalClient`
2. Add command-line argument parsing in the `main()` function
3. Update the help text in `show_help()`

### Interactive Mode

The interactive mode uses `questionary` for a guided experience. To customize prompts or add validation, modify the methods:

- `interactive_login()`
- `interactive_create_account()`
- `interactive_upload()`
- `interactive_query()`
- `interactive_list_docs()`

### Testing

To run the terminal client with the verification scripts:

```bash
# Run the built-in verification script
python scripts/verify.py

# Verify the agent can answer questions correctly
python scripts/verify_agent.py
```

## Notes

- The terminal client uses the same authentication system as the web interface
- Document uploads go through the same pipeline as the web interface
- Queries use the same agent system as the web interface
- All operations are tenant-aware (per-account)
