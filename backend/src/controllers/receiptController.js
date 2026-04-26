import PDFDocument from 'pdfkit';
import path from 'path';
import * as bookingService from '../services/bookingService.js';
import prisma from '../config/database.js';

// Путь к шрифту с поддержкой казахского/кириллицы.
// Положите, пожалуйста, файл DejaVuSans.ttf или другой Unicode‑шрифт в папку backend/fonts.
const fontPath = path.join(process.cwd(), 'fonts', 'DejaVuSans.ttf');

export const downloadReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get booking with payment info
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        arena: true,
        user: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
        payments: {
          where: {
            status: 'succeeded',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check authorization
    if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (booking.payments.length === 0) {
      return res.status(400).json({ error: 'No payment found for this booking' });
    }

    const payment = booking.payments[0];

    // Create PDF with Unicode support
    const doc = new PDFDocument({ 
      margin: 50,
      autoFirstPage: true
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${booking.id}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function to format dates
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('kk-KZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    const formatDateTime = (date) => {
      return new Date(date).toLocaleString('kk-KZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // Helper function to safely encode text for PDF
    const safeText = (text) => {
      if (!text) return '';
      // Ensure text is properly encoded as UTF-8
      return String(text).normalize('NFC');
    };

    // Подключаем основной шрифт (если файл найден)
    try {
      doc.registerFont('Main', fontPath);
      doc.font('Main');
    } catch (e) {
      // Если шрифт не найден, pdfkit использует шрифт по умолчанию
    }

    // Header
    doc.fontSize(24).text('ArenaBook', { align: 'center' });
    doc.fontSize(16).text(safeText('Чек'), { align: 'center' });
    doc.moveDown(2);

    // Booking details
    doc.fontSize(12);
    doc.text(safeText(`Брондау №: ${booking.id}`), { align: 'left' });
    doc.text(safeText(`Күні: ${formatDate(booking.createdAt)}`), { align: 'left' });
    doc.moveDown();

    // Arena info
    doc.fontSize(14).text(safeText('Арена туралы ақпарат:'), { underline: true });
    doc.fontSize(12);
    doc.text(safeText(`Атауы: ${booking.arena.title || 'Арена'}`));
    doc.text(safeText(`Мекенжайы: ${booking.arena.address || 'Мекенжай көрсетілмеген'}`));
    doc.moveDown();

    // Booking time
    doc.fontSize(14).text(safeText('Брондау уақыты:'), { underline: true });
    doc.fontSize(12);
    doc.text(safeText(`Басталуы: ${formatDateTime(booking.startDatetime)}`));
    doc.text(safeText(`Аяқталуы: ${formatDateTime(booking.endDatetime)}`));
    doc.moveDown();

    // Payment info
    doc.fontSize(14).text(safeText('Төлем туралы ақпарат:'), { underline: true });
    doc.fontSize(12);
    doc.text(safeText(`Сома: ${Number(booking.totalAmount || 0).toFixed(2)} ₸`));
    
    // Аударылған атаулар
    const providerNames = {
      cash: 'Қолма-қол',
      stripe: 'Stripe',
      kaspi: 'Kaspi.kz'
    };
    doc.text(safeText(`Төлем тәсілі: ${providerNames[payment.provider] || payment.provider}`));
    doc.text(safeText(`Төлем статусы: ${payment.status === 'succeeded' ? 'Төленді' : 'Күтілуде'}`));
    doc.moveDown();

    // User info
    doc.fontSize(14).text(safeText('Клиент туралы ақпарат:'), { underline: true });
    doc.fontSize(12);
    doc.text(safeText(`Толық аты-жөні: ${booking.user.fullName || 'Көрсетілмеген'}`));
    if (booking.user.email) {
      doc.text(safeText(`Email: ${booking.user.email}`));
    }
    if (booking.user.phone) {
      doc.text(safeText(`Телефон: ${booking.user.phone}`));
    }
    doc.moveDown(2);

    // Footer
    doc.fontSize(10).text(safeText('Рахмет!'), { align: 'center' });
    doc.text(safeText('ArenaBook – спорт ареналарын брондау платформасы'), { align: 'center' });

    // Finalize PDF
    doc.end();
  } catch (error) {
    next(error);
  }
};

