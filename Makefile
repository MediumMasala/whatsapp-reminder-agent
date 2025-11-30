.PHONY: help install dev build start test docker-up docker-down migrate setup

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

dev: ## Start development server
	npm run dev

build: ## Build TypeScript
	npm run build

start: ## Start production server
	npm start

test: ## Run tests
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

docker-up: ## Start Docker services (Postgres + Redis)
	docker-compose up -d postgres redis

docker-down: ## Stop Docker services
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

setup: ## Initial setup (install + docker + migrate)
	@echo "Installing dependencies..."
	npm install
	@echo "Starting Docker services..."
	docker-compose up -d postgres redis
	@echo "Waiting for database..."
	sleep 5
	@echo "Generating Prisma client..."
	npm run prisma:generate
	@echo "Running migrations..."
	npm run prisma:migrate
	@echo "Setup complete! Run 'make dev' to start."

migrate: ## Run database migrations
	npm run prisma:migrate

prisma-studio: ## Open Prisma Studio
	npm run prisma:studio

clean: ## Clean build artifacts
	rm -rf dist node_modules

lint: ## Run linter (if configured)
	npm run lint || echo "Linter not configured"
