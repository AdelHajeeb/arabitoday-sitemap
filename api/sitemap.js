const { Builder } = require('xml2js');
const admin = require('firebase-admin');

function escapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

module.exports = async (req, res) => {
  try {
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

    // ✅ جميع الصفحات الثابتة في موقعك
    const staticPages = [
      // الصفحات الرئيسية
      { loc: 'https://arabitoday.net/', priority: '1.0', changefreq: 'daily' },
      { loc: 'https://arabitoday.net/index.html', priority: '1.0', changefreq: 'daily' },
      
      // الصفحات الثابتة المهمة
      { loc: 'https://arabitoday.net/about.html', priority: '0.8', changefreq: 'monthly' },
      { loc: 'https://arabitoday.net/contact.html', priority: '0.8', changefreq: 'monthly' },
      { loc: 'https://arabitoday.net/privacy.html', priority: '0.6', changefreq: 'yearly' },
      { loc: 'https://arabitoday.net/terms.html', priority: '0.6', changefreq: 'yearly' },
      { loc: 'https://arabitoday.net/help.html', priority: '0.7', changefreq: 'weekly' },
      
      // صفحات الخدمات
      { loc: 'https://arabitoday.net/subscribe.html', priority: '0.7', changefreq: 'weekly' },
      { loc: 'https://arabitoday.net/unsubscribe.html', priority: '0.5', changefreq: 'monthly' },
      
      // صفحات المحتوى (أقسام)
      { loc: 'https://arabitoday.net/markets.html', priority: '0.9', changefreq: 'daily' },
      { loc: 'https://arabitoday.net/knowledge.html', priority: '0.8', changefreq: 'daily' },
      { loc: 'https://arabitoday.net/sitemap.html', priority: '0.7', changefreq: 'weekly' },
        // صفحة أسعار العملات
  { loc: 'https://arabitoday.net/currency.html', priority: '0.9', changefreq: 'daily' }, 
    ];

    staticPages.forEach(page => {
      urlset.urlset.url.push({
        loc: page.loc,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: page.changefreq,
        priority: page.priority
      });
    });

    const articlesSnapshot = await db.collection('articles')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    articlesSnapshot.forEach(doc => {
      const article = doc.data();
      const articleUrl = `https://arabitoday.net/${doc.id}.html`;
      
      let lastmod = new Date().toISOString().split('T')[0];
      if (article.updatedAt && article.updatedAt.toDate) {
        lastmod = article.updatedAt.toDate().toISOString().split('T')[0];
      } else if (article.createdAt && article.createdAt.toDate) {
        lastmod = article.createdAt.toDate().toISOString().split('T')[0];
      }

      let priority = '0.8';
      if (article.status === 'منشور') priority = '0.8';
      if (article.status === 'مسودة') priority = '0.7';
      if (article.status === 'نبذة') priority = '0.6';

      const urlEntry = {
        loc: articleUrl,
        lastmod: lastmod,
        changefreq: 'daily',
        priority: priority
      };

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

      if (article.imageUrl) {
        urlEntry['image:image'] = {
          'image:loc': article.imageUrl,
          'image:title': escapeXml(article.title || 'صورة المقال'),
          'image:caption': escapeXml(article.description || '')
        };
      }

      urlset.urlset.url.push(urlEntry);
    });

    const xml = xmlBuilder.buildObject(urlset);
    
    const finalXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${xml.substring(xml.indexOf('<url>'))}`;
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(finalXml);
    
    console.log(`✅ Sitemap بـ ${urlset.urlset.url.length} رابط`);
    
  } catch (error) {
    console.error('❌ خطأ:', error);
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>\n<error>${error.message}</error>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(500).send(errorXml);
  }
};