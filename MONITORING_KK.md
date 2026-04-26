# ArenaReserve мониторинг нұсқаулығы (Қазақша)

Бұл құжат ArenaReserve жобасының мониторинг жүйесін толық қазақша түсіндіреді.

## 1) Мониторинг не үшін керек

Мониторинг жүйесі 3 негізгі міндетті атқарады:

- сервер мен контейнер күйін бақылау;
- жоба API-інің қолжетімділігін тексеру;
- ақау шыққанда Telegram немесе Email арқылы ескерту жіберу.

## 2) Негізгі сервистер

Жоба Docker арқылы келесі сервистерді қолданады:

- Prometheus: метрикаларды жинайды және alert шарттарын тексереді;
- Grafana: метрикаларды дашборд түрінде көрсетеді;
- Alertmanager: критикалық жағдайда хабарлама жібереді;
- Portainer: Docker контейнерлерін web UI арқылы басқару;
- Node Exporter: хост метрикалары (CPU, RAM, диск);
- cAdvisor: Docker контейнер метрикалары;
- Blackbox Exporter: Arena API endpoint-ін тікелей probe жасайды.

## 3) Arena жобасымен тікелей байланыс

Бұл мониторинг ArenaReserve backend сервисіне тікелей байланған.

- Probe адресі: http://backend:3000/health
- Probe job атауы: arena-backend-probe
- Егер probe_success = 0 болса, ArenaBackendUnavailable alert іске қосылады.

Яғни, бұл тек жалпы сервер статистикасы емес, нақты жоба API күйін бақылайды.

## 4) Қалай іске қосылады

Production:

```bash
docker compose up -d --build
```

Development:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

## 5) Қай жерден көреміз

- Grafana: http://localhost:3002
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Portainer: http://localhost:9000

## 6) Grafana кіру деректері

Әдепкі мәндер:

- Логин: admin
- Пароль: admin123

Егер кірмесе (ескі volume сақталған болса), парольді қайта орнатыңыз:

```bash
docker compose exec grafana grafana-cli admin reset-admin-password admin123
```

## 7) Дашбордта не көрінеді

ArenaReserve сервер мониторингі дашбордында:

- CPU жүктемесі;
- Жедел жады жүктемесі;
- Түбірлік диск жүктемесі;
- Қолжетімсіз сервистер;
- Белсенді ескерту саны;
- Белсенді проблемалар;
- Arena API қолжетімділігі.

## 8) Ескертулер (Alert)

Қосылған негізгі alert ережелері:

- InstanceDown;
- HostHighCPU;
- HostHighMemory;
- HostDiskAlmostFull;
- ArenaBackendUnavailable.

Alert мәтіндері қазақшаға бейімделген.

## 9) Telegram және Email орнату

Нақты хабарлама алу үшін Alertmanager конфигіндегі placeholder мәндерді өз деректеріңізбен ауыстырыңыз:

- Telegram bot token;
- Telegram chat id;
- SMTP сервер параметрлері;
- алушы email.

Файл: monitoring/alertmanager/alertmanager.yml

Өзгерткеннен кейін сервис жаңартыңыз:

```bash
docker compose up -d --force-recreate --no-deps alertmanager
```

## 10) Тексеру командалары

Сервистер күйін тексеру:

```bash
docker compose ps
```

Probe метрикасын тексеру:

```bash
# Prometheus API арқылы
http://localhost:9090/api/v1/query?query=probe_success%7Bjob%3D%22arena-backend-probe%22%7D
```

Alert ережелерін тексеру:

```bash
http://localhost:9090/api/v1/rules
```

## 11) Жылдам диагностика

Егер бірдеңе ашылмаса:

1. docker compose ps арқылы контейнер статусын тексеріңіз;
2. docker compose logs -f prometheus grafana alertmanager арқылы логтарды қарап шығыңыз;
3. Prometheus Targets бетінде node-exporter, cadvisor, arena-backend-probe күйі UP екенін тексеріңіз.

Осыдан кейін дашбордта мәселе нақты көрінеді және alert арнасы арқылы хабарлама түседі.
