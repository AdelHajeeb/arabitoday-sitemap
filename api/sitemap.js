const { Builder } = require('xml2js');
// 1. استيراد مكتبة Firebase Admin
const admin = require('firebase-admin');

// 2. 🔥 تهيئة Firebase باستخدام مفتاح الخدمة من متغير البيئة
if (!admin.apps.length) {
  // تحويل النص من متغير البيئة إلى كائن JSON
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
    // لا حاجة لـ databaseURL إذا كنت تستخدم Firestore فقط
  });
}
const db = admin.firestore(); // هذا كائن قاعدة البيانات

// 3. بقية الدالة (جلب المقالات وتوليد XML)
module.exports = async (req, res) => {
  try {
    console.log('🚀 بدء توليد sitemap.xml مع المقالات...');
    
    const xmlBuilder = new Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } });
    const urlset = { urlset: { $: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' }, url: [] } };

    // إضافة الصفحة الرئيسية
    urlset.urlset.url.push({
      loc: 'https://arabitoday.net/',
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'daily',
      priority: '1.0'
    });

    // 🔥 جلب المقالات من Firestore
    console.log('📥 جلب المقالات من قاعدة البيانات...');
    const articlesSnapshot = await db.collection('articles')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    console.log(`✅ تم جلب ${articlesSnapshot.size} مقال`);

    // إضافة كل مقال إلى خريطة الموقع
    articlesSnapshot.forEach(doc => {
      const article = doc.data();
      const articleUrl = `https://arabitoday.net/article.html?id=${doc.id}`;

      let lastmod = new Date().toISOString().split('T')[0];
      if (article.updatedAt && article.updatedAt.toDate) {
        lastmod = article.updatedAt.toDate().toISOString().split('T')[0];
      }

      urlset.urlset.url.push({
        loc: articleUrl,
        lastmod: lastmod,
        changefreq: 'daily',
        priority: '0.8'
      });
    });

    const xml = xmlBuilder.buildObject(urlset);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
    console.log(`🎉 تم إنشاء Sitemap بـ ${urlset.urlset.url.length} رابط`);

  } catch (error) {
    console.error('❌ خطأ في الدالة:', error);
    res.status(500).send('<error>خطأ في توليد خريطة الموقع</error>');
  }
};