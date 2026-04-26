# Docker Setup для ArenaReserve

Этот проект настроен для работы с Docker и Docker Compose.

Полная версия по мониторингу на казахском языке:
- [MONITORING_KK.md](MONITORING_KK.md)

## Требования

- Docker Desktop (Windows/Mac) или Docker Engine + Docker Compose (Linux)
- Минимум 4GB свободной RAM


## Быстрый старт

### Шаг 1: База данных создается автоматически

PostgreSQL запускается внутри Docker (`database` сервис) и база `arenareserve` создается автоматически при первом запуске.

### Production режим

```bash
# Сборка и запуск всех сервисов
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f

# Остановка всех сервисов
docker-compose down

# Остановка с удалением volumes (удалит данные БД!)
docker-compose down -v
```

### Development режим

```bash
# Запуск в режиме разработки с hot reload
docker-compose -f docker-compose.dev.yml up -d --build

# Просмотр логов
docker-compose -f docker-compose.dev.yml logs -f

# Остановка
docker-compose -f docker-compose.dev.yml down
```

## Сервисы

После запуска будут доступны:

- **Frontend**: http://localhost:80 (production) или http://localhost:3001 (development)
- **Backend API**: http://localhost:3000/api
- **PostgreSQL**: localhost:5433 (контейнер Docker)
- **Redis**: localhost:6379
- **Prometheus**: http://localhost:9090 (production) или http://localhost:9091 (development)
- **Grafana**: http://localhost:3002 (production) или http://localhost:3003 (development)
- **Alertmanager**: http://localhost:9093 (production) или http://localhost:9094 (development)
- **Portainer**: http://localhost:9000 (production) или http://localhost:9001 (development)
- **Node Exporter**: http://localhost:9100/metrics (production) или http://localhost:9101/metrics (development)

## Мониторинг и алерты (Prometheus + Grafana + Alertmanager)

В проект добавлен monitoring-стек:

- `node-exporter` для метрик сервера (CPU, RAM, диск)
- `cadvisor` для метрик Docker-контейнеров
- `prometheus` для сбора метрик и вычисления alert rules
- `grafana` для визуального dashboard
- `alertmanager` для уведомлений в Telegram и Email
- `portainer` для управления Docker-контейнерами через web UI

### Что настроено

- Автоматический dashboard в Grafana: `ArenaReserve Server Overview`
- Критические алерты:
  - `InstanceDown`
  - `HostHighCPU` (>85% более 5 минут)
  - `HostHighMemory` (>90% более 5 минут)
  - `HostDiskAlmostFull` (>90% более 10 минут)

### Переменные для уведомлений

Добавьте в `.env` в корне проекта:

```env
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABCDEF...
TELEGRAM_CHAT_ID=-1001234567890

# Email SMTP
SMTP_SMARTHOST=smtp.gmail.com:587
SMTP_FROM=alerts@example.com
SMTP_AUTH_USERNAME=alerts@example.com
SMTP_AUTH_PASSWORD=your-app-password
SMTP_REQUIRE_TLS=true
ALERT_EMAIL_TO=devops@example.com

# Grafana auth
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=admin123
```

### Проверка мониторинга

```bash
# Production
docker-compose up -d --build
docker-compose ps

# Development
docker-compose -f docker-compose.dev.yml up -d --build
docker-compose -f docker-compose.dev.yml ps
```

Проверьте в Prometheus, что цели `node-exporter` и `cadvisor` имеют статус `UP`.

### Проверка алертов

В Prometheus UI (раздел Graph) можно временно проверить выражения:

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
```

При срабатывании критического алерта Alertmanager отправит сообщение в Telegram и Email.

## Қазақша түсіндірме (Arena серверімен байланыс)

Бұл мониторинг Docker арқылы сіздің Arena сервер жобаңызға тікелей байланған:

- Prometheus `http://backend:3000/health` endpoint-ін Blackbox Exporter арқылы тексереді.
- Grafana дашбордында `Arena API қолжетімділігі` панелі бар.
- Егер backend істемей қалса, `ArenaBackendUnavailable` critical alert іске қосылады.

Сондықтан бұл тек жалпы сервер метрикасы емес, жобаңыздың API күйін де нақты көрсетеді.

## Сохранение данных

- Данные PostgreSQL сохраняются в Docker volume и не пропадают при обычном `docker compose down`.
- Если база пустая при старте, backend автоматически добавит demo-данные (пользователи, арены, изображения).
- Не используйте `docker compose down -v`, если хотите сохранить данные.

## Переменные окружения

Создайте файл `.env` в корне проекта для настройки секретных ключей:

```env
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
# и другие переменные из backend/env.example
```

## Миграции базы данных

Миграции применяются автоматически при первом запуске. Для ручного применения:

```bash
# Production
docker-compose exec backend npx prisma migrate deploy

# Development
docker-compose -f docker-compose.dev.yml exec backend npx prisma migrate dev
```

## Сидирование базы данных

```bash
# Production
docker-compose exec backend npm run db:seed

# Development
docker-compose -f docker-compose.dev.yml exec backend npm run db:seed
```

## Полезные команды

```bash
# Просмотр статуса контейнеров
docker-compose ps

# Перезапуск конкретного сервиса
docker-compose restart backend

# Выполнение команд в контейнере
docker-compose exec backend sh
docker-compose exec database psql -U arenaserve_user -d arenareserve

# Просмотр логов конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database
```

## Устранение проблем

### Проблемы с портами

Если порты заняты, измените их в `docker-compose.yml`:

```yaml
ports:
  - "3000:3000"  # измените первый номер на свободный порт
```

### Очистка данных

```bash
# Удалить все контейнеры, сети и volumes
docker-compose down -v
docker system prune -a
```

### Пересборка без кэша

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Структура

- `docker-compose.yml` - Production конфигурация
- `docker-compose.dev.yml` - Development конфигурация с hot reload
- `backend/Dockerfile` - Production образ бэкенда
- `backend/Dockerfile.dev` - Development образ бэкенда
- `frontend/Dockerfile` - Production образ фронтенда (nginx)
- `frontend/Dockerfile.dev` - Development образ фронтенда (vite dev server)

