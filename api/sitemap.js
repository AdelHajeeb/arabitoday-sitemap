// api/sitemap.js - النسخة المُحسَّنة مع الأولويات
const { Builder } = require('xml2js');
const admin = require('firebase-admin');

// دالة تنظيف النص لملف XML
function escapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// تهيئة Firebase
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    console.log('🚀 بدء توليد sitemap.xml مع الأولويات...');
    
    const xmlBuilder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ' }
    });

    const urlset = {
      urlset: {
        $: {
          xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
          'xmlns:news': 'http://www.google.com/schemas/sitemap-news/0.9',
          'xmlns:image': 'http://www.google.com/schemas/sitemap-image/1.1'
        },
        url: []
      }
    };

    // 1️⃣ الصفحات الثابتة
    const staticPages = [
      { loc: 'https://arabitoday.net/', priority: '1.0' },
      { loc: 'https://arabitoday.net/about.html', priority: '0.9' },
      { loc: 'https://arabitoday.net/contact.html', priority: '0.8' },
      { loc: 'https://arabitoday.net/category.html?cat=politics', priority: '0.9' },
      { loc: 'https://arabitoday.net/category.html?cat=economy', priority: '0.9' },
      { loc: 'https://arabitoday.net/category.html?cat=sport', priority: '0.9' },
      { loc: 'https://arabitoday.net/category.html?cat=technology', priority: '0.9' },
      { loc: 'https://arabitoday.net/category.html?cat=entertain', priority: '0.9' },
      { loc: 'https://arabitoday.net/category.html?cat=culture', priority: '0.9' },
      { loc: 'https://arabitoday.net/category.html?cat=health', priority: '0.9' }
    ];

    staticPages.forEach(page => {
      urlset.urlset.url.push({
        loc: page.loc,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: page.priority
      });
    });

    // 2️⃣ جلب المقالات من Firestore
    console.log('📥 جلب المقالات مع الأولويات...');
    const articlesSnapshot = await db.collection('articles')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    console.log(`✅ تم جلب ${articlesSnapshot.size} مقال`);

    // 3️⃣ معالجة كل مقال مع الأولوية المناسبة
    articlesSnapshot.forEach(doc => {
      const article = doc.data();
      const articleUrl = `https://arabitoday.net/article.html?id=${doc.id}`;
      
      // تحديد تاريخ التعديل
      let lastmod = new Date().toISOString().split('T')[0];
      if (article.updatedAt && article.updatedAt.toDate) {
        lastmod = article.updatedAt.toDate().toISOString().split('T')[0];
      } else if (article.createdAt && article.createdAt.toDate) {
        lastmod = article.createdAt.toDate().toISOString().split('T')[0];
      }

      // 🎯 تحديد الأولوية حسب الحالة
      let priority = '0.8'; // الافتراضي
      if (article.status === 'منشور') priority = '0.8';
      if (article.status === 'نبذة') priority = '0.7';
      if (article.status === 'مسودة') priority = '0.6';

      const urlEntry = {
        loc: articleUrl,
        lastmod: lastmod,
        changefreq: 'daily',
        priority: priority,
        comment: `حالة: ${article.status || 'غير محدد'}`
      };

      // إضافة وسم Google News للمقالات المنشورة فقط
      if (article.status === 'منشور' && article.category !== 'المعرفة') {
        urlEntry['news:news'] = {
          'news:publication': {
            'news:name': 'اليوم العربي',
            'news:language': 'ar'
          },
          'news:publication_date': `${lastmod}T00:00:00Z`,
          'news:title': escapeXml(article.title || 'مقال')
        };
      }

      // إضافة صورة إن وجدت
      if (article.imageUrl) {
        urlEntry['image:image'] = {
          'image:loc': article.imageUrl,
          'image:title': escapeXml(article.title || 'صورة المقال'),
          'image:caption': escapeXml(article.description || '')
        };
      }

      urlset.urlset.url.push(urlEntry);
    });

    // 4️⃣ توليد XML
    const xml = xmlBuilder.buildObject(urlset);
    
    const finalXml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 
  🗺️ خريطة موقع اليوم العربي
  📅 التحديث: ${new Date().toLocaleDateString('ar-EG')}
  📊 عدد الروابط: ${urlset.urlset.url.length}
  🎯 الأولويات: منشور (0.8) | نبذة (0.7) | مسودة (0.6)
-->
${xml}`;
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=7200');
    res.setHeader('X-Sitemap-Stats', `articles=${articlesSnapshot.size}, date=${new Date().toISOString()}`);
    res.status(200).send(finalXml);
    
    console.log(`✅ تم توليد Sitemap بـ ${urlset.urlset.url.length} رابط`);
    console.log(`🎯 الأولويات: منشور (0.8) | نبذة (0.7) | مسودة (0.6)`);
    
  } catch (error) {
    console.error('❌ خطأ في sitemap:', error);
    res.status(500).send(`<error>خطأ في توليد خريطة الموقع: ${error.message}</error>`);
  }
};