// 贤霖科技 网站交互脚本

// ===== 站点数据加载（同时兼容两种部署方式）=====
// 1) 本地 / 云端 Node 服务器：优先走 /api/xxx 实时接口（能读到后台最新修改）
// 2) 纯静态托管（GitHub Pages / Cloudflare Pages 等）：接口不可用时自动读取 data/xxx.json
window.fetchSiteData = async function(type) {
  try {
    var res = await fetch('/api/' + type, { cache: 'no-store' });
    var ct = res.headers.get('content-type') || '';
    if (res.ok && ct.indexOf('json') !== -1) {
      var json = await res.json();
      if (json && Array.isArray(json.data)) return json.data;
    }
  } catch (e) { /* 静态托管环境没有后端接口，忽略 */ }
  try {
    var res2 = await fetch('data/' + type + '.json', { cache: 'no-store' });
    if (res2.ok) {
      var json2 = await res2.json();
      if (Array.isArray(json2)) return json2;
      if (json2 && Array.isArray(json2.data)) return json2.data;
    }
  } catch (e) {}
  return [];
};

document.addEventListener('DOMContentLoaded', function() {
  // 导航栏滚动效果
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', function() {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // 移动端菜单
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', function() {
      navMenu.classList.toggle('open');
    });
  }

  // 点击导航链接关闭移动端菜单
  document.querySelectorAll('.nav-menu a').forEach(function(link) {
    link.addEventListener('click', function() {
      navMenu.classList.remove('open');
    });
  });

  // 产品筛选
  const filterBtns = document.querySelectorAll('.filter-btn');
  const productCards = document.querySelectorAll('.product-card');
  if (filterBtns.length > 0) {
    filterBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        filterBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var category = btn.getAttribute('data-filter');
        productCards.forEach(function(card) {
          if (category === 'all' || card.getAttribute('data-category') === category) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // 联系表单提交
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var btn = contactForm.querySelector('button[type="submit"]');
      var originalText = btn.textContent;
      btn.textContent = '提交中...';
      btn.disabled = true;
      setTimeout(function() {
        alert('感谢您的留言！我们会尽快与您联系。');
        contactForm.reset();
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1200);
    });
  }

  // 滚动动画
  var observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  document.querySelectorAll('.business-card, .brand-card, .adv-card, .category-card, .product-card, .value-card, .solution-hero-card, .solution-detail-card').forEach(function(el, index) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease ' + (index % 6 * 0.08) + 's, transform 0.6s ease ' + (index % 6 * 0.08) + 's';
    observer.observe(el);
  });
});
