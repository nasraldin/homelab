# Homelab workspace — format & lint all sibling repos from the root.
#
#   cd ~/homelab
#   npm install          # once (Prettier)
#   make format          # write fixes
#   make lint            # check only
#
# Requires (brew): yamllint shellcheck
# Requires (optional): terraform  →  make format-tf / lint-tf

.PHONY: help install format lint clone clone-pull \
	format-prettier format-tf format-sh \
	lint-prettier lint-yaml lint-sh lint-tf \
	docs-install docs-collect docs-serve docs-build

ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
LABS := ansible-lab camunda-lab cloudflare-tunnel docker-lab \
	homelab-docs proxmox-bootstrap terraform-lab

# Shell scripts across labs (exclude git / terraform providers)
SH_FILES := $(shell find $(LABS) -type f \( -name '*.sh' \) \
	! -path '*/.git/*' ! -path '*/.terraform/*' ! -path '*/node_modules/*' 2>/dev/null)

help:
	@echo "Homelab workspace"
	@echo ""
	@echo "  make clone           Clone all labs from repos.conf (missing only)"
	@echo "  make clone-pull      Clone missing + ff-only pull existing"
	@echo "  make install         npm install (Prettier)"
	@echo "  make format          Prettier write + terraform fmt"
	@echo "  make lint            Prettier check + yamllint + shellcheck (+ tf fmt check)"
	@echo "  make docs-install    Create .venv-docs + install MkDocs"
	@echo "  make docs-serve      Collect lab docs + serve http://127.0.0.1:8000"
	@echo "  make docs-build      Collect lab docs + build ./site"
	@echo "  make format-prettier md/json/yml via Prettier"
	@echo "  make format-tf       terraform fmt -recursive in terraform-lab"
	@echo "  make lint-yaml       yamllint (uses .yamllint.yaml)"
	@echo "  make lint-sh         shellcheck (uses .shellcheckrc)"
	@echo "  make lint-tf         terraform fmt -check -recursive"

clone:
	./clone-labs.sh

clone-pull:
	./clone-labs.sh --pull

install:
	npm install

format: format-prettier format-tf
	@echo "format: done"

format-prettier:
	@command -v npx >/dev/null || { echo "need node/npm (run: make install)"; exit 1; }
	# Use .prettierignore only — root .gitignore excludes nested labs on purpose
	npx prettier --write . --ignore-path .prettierignore

format-tf:
	@command -v terraform >/dev/null || { echo "skip format-tf (terraform not installed)"; exit 0; }
	cd terraform-lab && terraform fmt -recursive

format-sh:
	@echo "shell scripts: use shfmt if installed (optional)"
	@if command -v shfmt >/dev/null; then \
		shfmt -w -i 2 -ci -sr $(SH_FILES); \
	else \
		echo "skip: brew install shfmt"; \
	fi

lint: lint-prettier lint-yaml lint-sh lint-tf
	@echo "lint: done"

lint-prettier:
	@command -v npx >/dev/null || { echo "need node/npm (run: make install)"; exit 1; }
	npx prettier --check . --ignore-path .prettierignore

lint-yaml:
	@command -v yamllint >/dev/null || { echo "need yamllint (brew install yamllint)"; exit 1; }
	yamllint -c $(ROOT).yamllint.yaml $(LABS)

lint-sh:
	@command -v shellcheck >/dev/null || { echo "need shellcheck (brew install shellcheck)"; exit 1; }
	@if [ -z "$(SH_FILES)" ]; then echo "no shell scripts"; exit 0; fi
	shellcheck --rcfile=$(ROOT).shellcheckrc $(SH_FILES)

lint-tf:
	@command -v terraform >/dev/null || { echo "skip lint-tf (terraform not installed)"; exit 0; }
	cd terraform-lab && terraform fmt -check -recursive

## Docs (MkDocs Material → GitHub Pages)

docs-install:
	python3 -m venv $(ROOT).venv-docs
	$(ROOT).venv-docs/bin/pip install -r $(ROOT)requirements-docs.txt

docs-collect:
	@chmod +x $(ROOT)scripts/collect-lab-docs.sh
	@$(ROOT)scripts/collect-lab-docs.sh

docs-serve: docs-collect
	@if [[ -x "$(ROOT).venv-docs/bin/mkdocs" ]]; then \
		"$(ROOT).venv-docs/bin/mkdocs" serve; \
	elif command -v mkdocs >/dev/null 2>&1; then \
		mkdocs serve; \
	else \
		echo "Run: make docs-install"; exit 1; \
	fi

docs-build: docs-collect
	@if [[ -x "$(ROOT).venv-docs/bin/mkdocs" ]]; then \
		"$(ROOT).venv-docs/bin/mkdocs" build --strict; \
	elif command -v mkdocs >/dev/null 2>&1; then \
		mkdocs build --strict; \
	else \
		echo "Run: make docs-install"; exit 1; \
	fi
