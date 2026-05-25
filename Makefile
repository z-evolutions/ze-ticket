.PHONY: test test-backend test-frontend build

test: test-backend test-frontend

test-backend:
	docker exec -w /app ze_ticket_backend python -m pytest tests/ -v

test-frontend:
	cd frontend && npm test

build:
	cd frontend && npm run build
	docker restart ze_ticket_backend
