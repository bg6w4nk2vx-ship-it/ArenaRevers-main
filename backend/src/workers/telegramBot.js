import dotenv from 'dotenv';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const GRAFANA_URL = process.env.GRAFANA_URL || 'http://localhost:3002';
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://localhost:9091';
const GRAPHITE_URL = process.env.GRAPHITE_URL || 'http://localhost:8000';

const API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

class TelegramBot {
  constructor() {
    this.lastUpdateId = 0;
    this.pollDelayMs = 1000;
    this.allowedChatId = String(TELEGRAM_CHAT_ID);
  }

  async sendMessage(chatId, text, parseMode = 'Markdown') {
    try {
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      });
    } catch (error) {
      console.error('Error sending message:', error.message);
    }
  }

  async sendPhoto(chatId, photoUrl, caption = '') {
    try {
      await axios.post(`${API_URL}/sendPhoto`, {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Error sending photo:', error.message);
      if (caption) {
        await this.sendMessage(chatId, caption);
      }
    }
  }

  async promInstant(query) {
    const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
      params: { query },
      timeout: 6000,
    });
    const item = response?.data?.data?.result?.[0];
    if (!item || !item.value || item.value.length < 2) {
      return null;
    }
    const value = Number(item.value[1]);
    return Number.isFinite(value) ? value : null;
  }

  async promRange(query, startSec, endSec, stepSec) {
    const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
      params: {
        query,
        start: startSec,
        end: endSec,
        step: stepSec,
      },
      timeout: 7000,
    });

    const values = response?.data?.data?.result?.[0]?.values || [];
    return values
      .map((point) => Number(point[1]))
      .filter((v) => Number.isFinite(v));
  }

  async getUpdates() {
    try {
      const response = await axios.get(`${API_URL}/getUpdates`, {
        params: { offset: this.lastUpdateId + 1, timeout: 30 },
      });
      return response.data.result || [];
    } catch (error) {
      if (error.response?.status !== 409) {
        console.error('Error getting updates:', error.message);
      }
      return [];
    }
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async handleCommand(chatId, command) {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case '/start':
        await this.cmdStart(chatId);
        break;
      case '/status':
        await this.cmdStatus(chatId);
        break;
      case '/graph':
        await this.cmdGraph(chatId);
        break;
      case '/containers':
        await this.cmdContainers(chatId);
        break;
      case '/top':
        await this.cmdTop(chatId);
        break;
      case '/logs':
        await this.cmdLogs(chatId, args[0]);
        break;
      case '/ping':
        await this.cmdPing(chatId);
        break;
      case '/graphite':
        await this.cmdGraphite(chatId);
        break;
      case '/help':
        await this.cmdHelp(chatId);
        break;
      default:
        await this.sendMessage(chatId, '❌ Неизвестная команда. Используй /help', 'Markdown');
    }
  }

  async cmdStart(chatId) {
    const message = `🎯 *Arena Reserve Monitoring Bot*

Привет! Это бот для управления системой мониторинга ArenaReserve.

Доступные команды:
• /status - Статус системы и API
• /graph - Ссылка на Grafana дашборд
• /graphite - Graphite архив метрик (долгосрочное хранение)
• /containers - Список контейнеров
• /top - Топ процессов
• /logs [имя] - Логи контейнера
• /ping - Проверка доступности API
• /help - Справка

Начни с /status чтобы увидеть здоровье системы.`;
    await this.sendMessage(chatId, message);
  }

  async cmdHelp(chatId) {
    const message = `📋 *Справка по командам*

• /status - Общий статус системы и API
• /graphite - Graphite архив метрик (долгосрочное хранение, месяцы/годы)
• /graph - Ссылка на Grafana и текущие показатели
• /containers - Список всех контейнеров с статусом
• /top - Топ процессов на хосте
• /logs - Показать список контейнеров для логов
• /logs <имя> - Последние строки логов контейнера
• /ping - Проверка доступности backend API
• /help - Эта справка`;
    await this.sendMessage(chatId, message);
  }

  async cmdStatus(chatId) {
    try {
      const backendHealth = await axios
        .get('http://backend:3000/health', { timeout: 5000 })
        .then(() => 'Healthy')
        .catch(() => 'Down');

      const [cpu, ram, disk, rows] = await Promise.all([
        this.promInstant('100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
        this.promInstant('(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100'),
        this.promInstant('(1 - (node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{mountpoint="/",fstype!~"tmpfs|overlay"})) * 100'),
        execAsync("docker ps --format '{{.Names}}|{{.Status}}'"),
      ]);

      const list = rows.stdout
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
      const total = list.length;
      const down = list.filter((x) => !x.toLowerCase().includes('up')).length;
      const containersState = down === 0 ? 'OK' : `Issues (${down}/${total})`;

      const fmt = (v) => (v === null ? 'No data' : `${v.toFixed(1)}%`);
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      const message = `🧠 *ArenaReserve Monitor*\n` +
        `🕒 Time: ${now}\n` +
        `────────────────────\n` +
        `🟢 CPU: ${fmt(cpu)}\n` +
        `🟢 RAM: ${fmt(ram)}\n` +
        `🟢 DISK: ${fmt(disk)}\n` +
        `\n` +
        `🐳 Контейнеры: ${containersState}\n` +
        `🌐 Backend API: ${backendHealth}\n` +
        `────────────────────\n` +
        `✅ Все системы в норме`;

      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, `⚠️ Error checking status: ${error.message}`);
    }
  }

  async cmdGraph(chatId) {
    try {
      const endSec = Math.floor(Date.now() / 1000);
      const startSec = endSec - 3600;
      const cpuSeries = await this.promRange(
        '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
        startSec,
        endSec,
        60
      );

      if (cpuSeries.length === 0) {
        await this.sendMessage(chatId, `📊 *График недоступен*\n\nОткрой Grafana: ${GRAFANA_URL}`);
        return;
      }

      const labels = cpuSeries.map((_, i) => `${i}m`);
      const chartConfig = {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'CPU %',
              data: cpuSeries,
              borderColor: '#e74c3c',
              backgroundColor: 'rgba(231, 76, 60, 0.08)',
              borderWidth: 2,
              fill: true,
              pointRadius: 0,
              tension: 0.25,
            },
          ],
        },
        options: {
          plugins: {
            title: {
              display: true,
              text: 'CPU график (last 1h)',
              font: { size: 16 },
            },
            legend: { display: true },
          },
          scales: {
            y: {
              min: 0,
              max: 100,
            },
          },
        },
      };

      const chartUrl = `https://quickchart.io/chart?width=900&height=420&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
      await this.sendPhoto(chatId, chartUrl, `📈 CPU график (last 1h)\nGrafana: ${GRAFANA_URL}`);
    } catch (error) {
      await this.sendMessage(chatId, `⚠️ Ошибка построения графика: ${error.message}\nGrafana: ${GRAFANA_URL}`);
    }
  }

  async cmdContainers(chatId) {
    try {
      const { stdout } = await execAsync("docker ps --format '{{.Names}}|{{.Status}}'");
      const rows = stdout
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20);

      if (rows.length === 0) {
        await this.sendMessage(chatId, '⚠️ Контейнеры не найдены');
        return;
      }

      let message = '🐳 *Docker Containers*\n\n';
      for (const row of rows) {
        const [name, statusText] = row.split('|');
        const status = statusText?.toLowerCase().includes('up') ? '✅' : '❌';
        message += `${status} ${name} - ${statusText}\n`;
      }

      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, `⚠️ Ошибка чтения контейнеров: ${error.message}`);
    }
  }

  async cmdTop(chatId) {
    try {
      const { stdout } = await execAsync('top -bn1 | head -n 15 2>/dev/null || ps aux --sort=-%cpu | head -n 10');
      const lines = stdout.split('\n').slice(0, 12).join('\n');
      const message = `⚡ *Top Processes*\n\`\`\`\n${lines}\n\`\`\``;
      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, `⚠️ Error getting top processes: ${error.message}`);
    }
  }

  async cmdLogs(chatId, containerName) {
    if (!containerName) {
      try {
        const { stdout } = await execAsync("docker ps -a --format '{{.Names}}'");
        const names = stdout
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 20);

        if (names.length === 0) {
          await this.sendMessage(chatId, '⚠️ Контейнеры не найдены');
          return;
        }

        const lines = names.map((name) => `• ${name}`).join('\n');
        const help = `📝 *Логи контейнеров*\n\nДоступные контейнеры:\n${lines}\n\nПример:\n/logs backend\n/logs prometheus`;
        await this.sendMessage(chatId, help);
      } catch (error) {
        await this.sendMessage(chatId, `⚠️ Ошибка чтения списка контейнеров: ${error.message}`);
      }
      return;
    }

    try {
      const { stdout: namesOut } = await execAsync("docker ps -a --format '{{.Names}}'");
      const names = namesOut.split('\n').map((x) => x.trim()).filter(Boolean);
      const found = names.find((n) => n.includes(containerName));

      if (!found) {
        await this.sendMessage(chatId, `⚠️ Контейнер не найден: ${containerName}`);
        return;
      }

      const { stdout, stderr } = await execAsync(`docker logs --tail 20 ${found}`);
      const logs = `${stdout || ''}${stderr || ''}`.trim();
      const body = logs ? logs.slice(-3500) : 'Логи пустые';
      const message = `📝 *Logs: ${found}*\n\`\`\`\n${body}\n\`\`\``;
      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, `⚠️ Ошибка чтения логов: ${error.message}`);
    }
  }

  async cmdPing(chatId) {
    try {
      const startTime = Date.now();
      await axios.get('http://backend:3000/health', { timeout: 5000 });
      const responseTime = Date.now() - startTime;
      await this.sendMessage(chatId, `✅ Backend is alive! Response: ${responseTime}ms`);
    } catch (error) {
      await this.sendMessage(chatId, '❌ Backend is unreachable');
    }
  }

  async cmdGraphite(chatId) {
    try {
      const message = `📊 *Graphite: Долгосрочное хранилище метрик*

*Что это?*
Graphite хранит все метрики от Prometheus (Pull модель) архивом. Это позволяет:
• Хранить данные месяцы и годы (вместо 15 дней в Prometheus)
• Анализировать долгосрочные тренды
• Работать с разреженными данными

*Просмотр данных:*
🔗 Web интерфейс: ${GRAPHITE_URL}
📊 Графики в Grafana: ${GRAFANA_URL}

*Метрики в Graphite:*
• server.cpu.* - CPU использование
• server.memory.* - RAM использование  
• server.disk.* - Disk использование
• docker.* - Docker контейнеры

*Push/Pull модели:*
• Pull (Prometheus): Сам запрашивает метрики
• Push (Graphite): Получает метрики на Carbon API (port 2003)

Prometheus -> Graphite Adapter -> Graphite Carbon`;
      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, `⚠️ Ошибка: ${error.message}`);
    }
  }

  async start() {
    console.log('🤖 Telegram Bot started');

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('❌ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
      return;
    }

    await this.sendMessage(TELEGRAM_CHAT_ID, '🚀 Bot is online and ready!');

    while (true) {
      const updates = await this.getUpdates();

      for (const update of updates) {
        this.lastUpdateId = update.update_id;

        const chatId = update.message?.chat?.id;
        const text = update.message?.text;
        if (!text || !text.startsWith('/')) {
          continue;
        }

        if (this.allowedChatId && String(chatId) !== this.allowedChatId) {
          await this.sendMessage(chatId, '⛔ Access denied');
          continue;
        }

        console.log(`Command: ${text} from chat ${chatId}`);
        await this.handleCommand(chatId, text);
      }

      await this.sleep(this.pollDelayMs);
    }
  }
}

const bot = new TelegramBot();
bot.start();
