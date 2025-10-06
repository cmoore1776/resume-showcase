#!/bin/bash
# Setup script to install Git hooks for the project

set -e

echo "🔧 Setting up Git hooks..."

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

# Check if we're in a git repository
if [ ! -d "$REPO_ROOT/.git" ]; then
    echo "❌ Error: Not in a Git repository"
    exit 1
fi

# Copy pre-commit hook
if [ -f "$HOOKS_DIR/pre-commit" ]; then
    echo "⚠️  Pre-commit hook already exists. Backing up to pre-commit.backup"
    mv "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-commit.backup"
fi

cat > "$HOOKS_DIR/pre-commit" << 'HOOK_EOF'
#!/bin/bash
# Pre-commit hook that runs all checks before allowing commits
# This ensures code quality and prevents broken code from being committed

set -e

echo "🔍 Running pre-commit checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

# Function to print section headers
print_section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Function to handle check results
check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2 passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $2 failed${NC}"
        FAILED=1
        return 1
    fi
}

# 1. Frontend Linting
print_section "1. Frontend Linting"
cd frontend
if pnpm lint > /dev/null 2>&1; then
    check_result 0 "ESLint"
else
    check_result 1 "ESLint"
fi
cd ..

# 2. Frontend TypeScript Check
print_section "2. Frontend TypeScript"
cd frontend
if pnpm tsc > /dev/null 2>&1; then
    check_result 0 "TypeScript compilation"
else
    check_result 1 "TypeScript compilation"
fi
cd ..

# 3. Frontend Build
print_section "3. Frontend Build"
cd frontend
if pnpm build > /dev/null 2>&1; then
    check_result 0 "Frontend build"
else
    check_result 1 "Frontend build"
fi
cd ..

# 4. Backend Linting
print_section "4. Backend Linting"
if command -v ruff &> /dev/null; then
    if ruff check backend/ > /dev/null 2>&1; then
        check_result 0 "Ruff linter"
    else
        check_result 1 "Ruff linter"
    fi

    if ruff format --check backend/ > /dev/null 2>&1; then
        check_result 0 "Ruff formatter"
    else
        check_result 1 "Ruff formatter"
    fi
else
    echo -e "${YELLOW}⊘ Ruff not installed, skipping Python linting${NC}"
fi

# 5. Terraform Validation
print_section "5. Terraform Validation"
if command -v terraform &> /dev/null; then
    cd terraform

    # Initialize if needed
    if [ ! -d ".terraform" ]; then
        echo "Initializing Terraform..."
        terraform init -backend=false > /dev/null 2>&1
    fi

    # Validate
    if terraform validate > /dev/null 2>&1; then
        check_result 0 "Terraform validate"
    else
        check_result 1 "Terraform validate"
    fi

    # Format check
    if terraform fmt -check > /dev/null 2>&1; then
        check_result 0 "Terraform format"
    else
        echo -e "${YELLOW}⚠ Terraform files need formatting (run: terraform fmt)${NC}"
        FAILED=1
    fi

    cd ..
else
    echo -e "${YELLOW}⊘ Terraform not installed, skipping validation${NC}"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Proceeding with commit.${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please fix the issues before committing.${NC}"
    echo ""
    echo "To skip these checks temporarily, use:"
    echo "  git commit --no-verify"
    echo ""
    exit 1
fi
HOOK_EOF

# Make the hook executable
chmod +x "$HOOKS_DIR/pre-commit"

echo "✅ Pre-commit hook installed successfully!"
echo ""
echo "The hook will run the following checks before each commit:"
echo "  • Frontend linting (ESLint)"
echo "  • Frontend TypeScript compilation"
echo "  • Frontend build"
echo "  • Backend linting (Ruff)"
echo "  • Terraform validation & format check"
echo ""
echo "To skip the hook temporarily, use: git commit --no-verify"
