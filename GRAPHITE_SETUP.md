# Graphite Setup Guide

## Overview

Graphite был добавлен как долгосрочное хранилище метрик, параллельно с Prometheus. Это позволяет архивировать метрики на месяцы и годы для трендового анализа.

## Architecture

```
node-exporter → \
cAdvisor      → → Prometheus (Pull) → Graphite Adapter → Graphite (Carbon + Whisper Storage)
blackbox      → /                     (remote_write)
```

### Компоненты

1. **Graphite (graphiteapp/graphite-statsd:1.1.10-4)**
   - Carbon: Приемник метрик (plaintext протокол, port 2003)
   - Whisper: Хранилище данных на диске (долгосрочное)
   - Web UI: Визуализация (port 80 → dev: 8003, prod: 8000)

2. **Graphite Adapter (prometheuscommunity/prometheus-graphite-adapter:0.1.15)**
   - Конвертирует Prometheus remote_write формат в Graphite Carbon протокол
   - Слушает на port 9009

3. **Prometheus (с remote_write)**
   - Продолжает собирать метрики как обычно
   - Отправляет их в Graphite через adapter для архивирования

## Ports

### Development
- Graphite Web UI: http://localhost:8003
- Carbon plaintext: localhost:2003
- StatsD: localhost:8125 (TCP/UDP)
- Graphite Adapter: localhost:9009

### Production
- Graphite Web UI: http://localhost:8000
- Carbon plaintext: localhost:2003
- StatsD: localhost:8125 (TCP/UDP)
- Graphite Adapter: localhost:9009

## Accessing Graphite

### Web Interface
```
Development: http://localhost:8003
Production:  http://localhost:8000
```

### Via Grafana
Graphite добавлен как datasource в Grafana provisioning. Можно создавать графики с историей месяцы назад:
- Grafana datasource: `Graphite` (uid: graphite)
- Метрики доступны через query builder

### Via Telegram Bot
```
/graphite - Показать информацию о Graphite и ссылку на web interface
```

## Metrics Available in Graphite

Все метрики от Prometheus автоматически архивируются:

```
server.cpu.*                    # CPU использование
server.memory.*                 # RAM использование
server.disk.*                   # Disk использование
docker.container_cpu.*          # Docker container CPU
docker.container_memory.*       # Docker container memory
node_*                          # node-exporter метрики
container_*                     # cAdvisor метрики
up                              # Service up/down status
```

## Retention Policy

Graphite хранит метрики с разными resolution по времени:
- 1 минута разрешение: 7 дней
- 5 минут разрешение: 180 дней (6 месяцев)
- 30 минут разрешение: 1825 дней (5 лет)

Это контролируется конфигом Whisper. По умолчанию graphiteapp/graphite-statsd образ имеет стандартную retention policy.

## Configuration Files Modified

1. **docker-compose.dev.yml**
   - Добавлены сервисы: graphite, graphite-adapter
   - Добавлен volume: graphite_data_dev
   - GRAPHITE_URL для telegram-bot

2. **docker-compose.yml** (production)
   - Добавлены сервисы: graphite, graphite-adapter
   - Добавлен volume: graphite_data
   - GRAPHITE_URL для telegram-bot

3. **monitoring/prometheus/prometheus.yml**
   - Добавлен блок `remote_write` для отправки метрик в Graphite adapter

4. **monitoring/grafana/provisioning/datasources/datasource.yml**
   - Добавлена Graphite datasource (uid: graphite)

5. **backend/src/workers/telegramBot.js**
   - Добавлена переменная GRAPHITE_URL
   - Добавлена команда /graphite с информацией о системе

## Starting the Services

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose up -d
```

Graphite требует несколько секунд для инициализации. Проверь статус:

```bash
docker-compose logs graphite
docker-compose logs graphite-adapter
```

## Testing Graphite

### Test метриками (если нужна отправка StatsD)
```bash
# Отправить тестовую метрику
echo "test.metric:100|g" | nc -w1 -u localhost 8125
```

### Проверить данные в Graphite
1. Открыть Web UI: http://localhost:8003
2. Перейти в "Metrics" и выбрать метрику
3. Выбрать временной диапазон (месяцы назад)

### Проверить remote_write
```bash
curl http://localhost:9090/api/v1/config
```

Должен показать `remote_write` конфиг.

## Troubleshooting

### Graphite не получает метрики
1. Проверь, что adapter запущен: `docker logs arenaserve-graphite-adapter`
2. Проверь Prometheus remote_write конфиг: `curl http://localhost:9090/api/v1/config`
3. Проверь, что Prometheus может достучаться до adapter: `curl http://graphite-adapter:9009`

### Adapter не может достучаться до Graphite
```bash
docker exec arenaserve-graphite-adapter telnet graphite 2003
```

Должно установить соединение.

### Grafana не видит Graphite datasource
1. Перезагрузи Grafana: `docker restart arenaserve-grafana`
2. Проверь provisioning файл: `monitoring/grafana/provisioning/datasources/datasource.yml`
3. Добавь datasource вручную в Grafana UI

## Performance

- Graphite занимает ~2-3GB на диск за месяц (зависит от кол-ва метрик)
- CPU использование минимально (пассивное хранилище)
- Whisper query может быть медленнее чем Prometheus для вещественного времени

## Next Steps

- Настроить custom retention policies в Graphite (если нужно)
- Создать историческое графики в Grafana (месяцы назад)
- Настроить automated reports на основе Graphite данных
- Backup strategy для graphite_data volume

## Pull vs Push Model Summary

| Aspect | Prometheus (Pull) | Graphite (Push) |
|--------|-------------------|-----------------|
| Model | Prometheus запрашивает метрики | Exporters отправляют метрики |
| Retention | ~15 дней | Месяцы/годы (Whisper) |
| Real-time | Лучше (instant) | Хорошо (buffer) |
| Buffering | Нет | Есть (если collector недоступен) |
| Масштабируемость | Хорошо (много targets) | Отличнo (множество clients) |
| Failure modes | Потеря при перезагрузке Prometheus | Потеря при перебое сети |

В нашем случае мы используем оба: Prometheus для real-time мониторинга + Graphite для долгосрочного архива.
