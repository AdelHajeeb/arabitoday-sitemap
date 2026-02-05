// api/sitemap.js
const { Builder } = require('xml2js');

module.exports = async (req, res) => {
  // إعداد XML بسيط
  const xmlBuilder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  });
  
  const simpleSitemap = {
    urlset: {
      $: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' },
      url: [
        {
          loc: 'https://arabitoday.net/',
          lastmod: new Date().toISOString().split('T')[0],
          changefreq: 'daily',
          priority: '1.0'
        }
        // يمكنك إضافة المزيد هنا لاحقاً
      ]
    }
  };
  
  const xml = xmlBuilder.buildObject(simpleSitemap);
  
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.status(200).send(xml);
  
  console.log('✅ Sitemap generated on Vercel');
};