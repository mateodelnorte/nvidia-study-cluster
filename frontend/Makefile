# GPU Watchdog - Frontend Makefile
# =============================================================================

.PHONY: help install dev build preview test test-ui lint lint-fix format ladle clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install

dev: ## Start development server
	pnpm dev

build: ## Build for production
	pnpm build

preview: ## Preview production build
	pnpm preview

test: ## Run tests
	pnpm test

test-ui: ## Run tests with UI
	pnpm test:ui

lint: ## Check code with Biome
	pnpm lint

lint-fix: ## Fix code issues with Biome
	pnpm lint:fix

format: ## Format code with Biome
	pnpm format

ladle: ## Start Ladle component explorer
	pnpm ladle

ladle-build: ## Build Ladle for production
	pnpm ladle:build

clean: ## Clean build artifacts
	rm -rf dist node_modules/.vite
