/**
 * 맞춤형 뉴스 리더 - Pure Vanilla JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM 요소 참조
  const topicForm = document.getElementById('topic-form');
  const newsFeed = document.getElementById('news-feed');
  const statusMessage = document.getElementById('status-message');
  const scrollSentinel = document.getElementById('scroll-sentinel');
  const loadingIndicator = document.getElementById('loading-indicator');
  
  // 모달 요소
  const modal = document.getElementById('article-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalTopic = document.getElementById('modal-topic');
  const modalTitle = document.getElementById('modal-title');
  const modalImage = document.getElementById('modal-image');
  const modalBodyContent = document.getElementById('modal-body-content');

  // 2. 주제 매핑 및 설정
  const TOPIC_CONFIG = {
    'IT': {
      tag: 'technology',
      className: 'badge-it',
      fallbackImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80'
    },
    '비즈니스': {
      tag: 'business',
      className: 'badge-비즈니스',
      fallbackImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80'
    },
    '경제': {
      tag: 'economy',
      className: 'badge-경제',
      fallbackImage: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80'
    }
  };

  // 3. 상태 관리 변수
  let selectedTopics = ['IT', '비즈니스', '경제'];
  let topicPageMap = {
    'IT': 1,
    '비즈니스': 1,
    '경제': 1
  };
  let isFetching = false;
  let hasInitialLoaded = false;
  let articlesStore = new Map(); // id -> article 데이터 보관

  // 4. OpenAPI 기사 데이터 패칭 함수 (DEV.to 무료 OpenAPI 활용)
  async function fetchArticlesFromApi(topic, page, perPage) {
    const config = TOPIC_CONFIG[topic];
    if (!config) return [];

    const url = `https://dev.to/api/articles?tag=${encodeURIComponent(config.tag)}&page=${page}&per_page=${perPage}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP 오류: ${response.status}`);
      }
      const data = await response.json();
      
      // 정규화된 기사 객체 배열 반환
      return data.map((item) => {
        const image = item.cover_image || item.social_image || config.fallbackImage;
        const normalized = {
          id: String(item.id),
          topic: topic,
          title: item.title,
          image: image,
          description: item.description || '기사 내용이 제공되지 않았습니다.',
          bodyHtml: item.body_html || null,
          url: item.url
        };
        // 캐시에 저장
        articlesStore.set(normalized.id, normalized);
        return normalized;
      });
    } catch (error) {
      console.warn(`[${topic}] API 요청 실패:`, error);
      // 오프라인 혹은 일시적 오류 시 예비 데이터 반환
      return getFallbackArticles(topic, page, perPage);
    }
  }

  // 5. 오프라인/비상용 예비 기사 생성기
  function getFallbackArticles(topic, page, count) {
    const fallbackList = [];
    for (let i = 1; i <= count; i++) {
      const idx = (page - 1) * count + i;
      const id = `fallback-${topic}-${idx}`;
      const item = {
        id: id,
        topic: topic,
        title: `[${topic}] 최신 주요 산업 동향 및 인사이트 분석 리포트 #${idx}`,
        image: TOPIC_CONFIG[topic].fallbackImage,
        description: `${topic} 분야의 최근 핵심 트렌드와 산업 변화에 대한 상세 분석 내용입니다. 글로벌 시장에서의 주요 이슈와 국내외 전문가들의 견해를 바탕으로 한 종합 정리 기사입니다.`,
        bodyHtml: `<p>${topic} 분야의 최근 핵심 트렌드와 산업 변화에 대한 상세 분석 내용입니다.</p><p>디지털 전환과 시장 환경 변화 속에서 주요 기업들과 기술 리더들이 주목하는 최신 전략을 심층 취재했습니다. 장기적 성장을 위한 핵심 동향과 전망을 확인해 보세요.</p>`,
        url: '#'
      };
      articlesStore.set(item.id, item);
      fallbackList.push(item);
    }
    return fallbackList;
  }

  // 6. 카드 엘리먼트 생성
  function createArticleCard(article) {
    const card = document.createElement('article');
    card.className = 'news-card';
    card.dataset.id = article.id;

    const topicConfig = TOPIC_CONFIG[article.topic] || { className: 'badge-it' };

    card.innerHTML = `
      <div class="card-image-wrap">
        <img class="card-image" src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" loading="lazy" onerror="this.onerror=null;this.src='${topicConfig.fallbackImage}';">
        <span class="topic-badge ${topicConfig.className}">${escapeHtml(article.topic)}</span>
      </div>
      <div class="card-content">
        <h2 class="card-title">${escapeHtml(article.title)}</h2>
        <button type="button" class="btn-read" data-id="${article.id}">읽기</button>
      </div>
    `;

    return card;
  }

  // 7. XSS 방지용 HTML 이스케이프 함수
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 8. 선택된 각 주제별 상위 10개 기사 가져오기 ('뉴스보기' 클릭 시)
  async function loadInitialNews() {
    if (selectedTopics.length === 0) {
      statusMessage.textContent = '주제를 하나 이상 선택해주세요.';
      statusMessage.className = 'status-message error';
      newsFeed.innerHTML = '';
      return;
    }

    isFetching = true;
    statusMessage.textContent = '';
    statusMessage.className = 'status-message';
    newsFeed.innerHTML = '';
    loadingIndicator.style.display = 'flex';

    // 각 주제 페이지 리셋
    selectedTopics.forEach((topic) => {
      topicPageMap[topic] = 1;
    });

    try {
      // 선택된 각 주제별로 상위 10개씩 OpenAPI 호출
      const promises = selectedTopics.map((topic) =>
        fetchArticlesFromApi(topic, 1, 10)
      );

      const results = await Promise.all(promises);
      const allArticles = results.flat();

      if (allArticles.length === 0) {
        statusMessage.textContent = '가져올 수 있는 뉴스가 없습니다.';
        return;
      }

      // 카드 렌더링
      const fragment = document.createDocumentFragment();
      allArticles.forEach((article) => {
        fragment.appendChild(createArticleCard(article));
      });
      newsFeed.appendChild(fragment);

      hasInitialLoaded = true;
    } catch (err) {
      console.error('뉴스 로딩 실패:', err);
      statusMessage.textContent = '뉴스를 불러오는 중 오류가 발생했습니다.';
      statusMessage.className = 'status-message error';
    } finally {
      loadingIndicator.style.display = 'none';
      isFetching = false;
    }
  }

  // 9. 무한 스크롤: 기사 10건 추가 로드
  async function loadMoreArticles() {
    if (isFetching || !hasInitialLoaded || selectedTopics.length === 0) return;

    isFetching = true;
    loadingIndicator.style.display = 'flex';

    try {
      // 선택된 주제들에 분배하여 총 10건 가져오기
      const totalToFetch = 10;
      const countPerTopic = Math.floor(totalToFetch / selectedTopics.length);
      const remainder = totalToFetch % selectedTopics.length;

      const fetchTasks = selectedTopics.map((topic, index) => {
        const count = countPerTopic + (index < remainder ? 1 : 0);
        if (count <= 0) return Promise.resolve([]);
        topicPageMap[topic] = (topicPageMap[topic] || 1) + 1;
        return fetchArticlesFromApi(topic, topicPageMap[topic], count);
      });

      const results = await Promise.all(fetchTasks);
      const newArticles = results.flat();

      if (newArticles.length > 0) {
        const fragment = document.createDocumentFragment();
        newArticles.forEach((article) => {
          fragment.appendChild(createArticleCard(article));
        });
        newsFeed.appendChild(fragment);
      }
    } catch (err) {
      console.error('추가 뉴스 로드 실패:', err);
    } finally {
      loadingIndicator.style.display = 'none';
      isFetching = false;
    }
  }

  // 10. 모달 열기 및 본문 로드
  async function openArticleModal(articleId) {
    const article = articlesStore.get(articleId);
    if (!article) return;

    const topicConfig = TOPIC_CONFIG[article.topic] || { className: 'badge-it' };

    modalTopic.textContent = article.topic;
    modalTopic.className = `topic-badge ${topicConfig.className}`;
    modalTitle.textContent = article.title;
    modalImage.src = article.image;
    modalImage.alt = article.title;

    // 본문 표시: 캐시된 bodyHtml 또는 description 우선 표시
    if (article.bodyHtml) {
      modalBodyContent.innerHTML = article.bodyHtml;
    } else {
      modalBodyContent.innerHTML = `<p>${escapeHtml(article.description)}</p>`;
      
      // 실제 API 기사인 경우 상세 본문 fetch 시도
      if (!article.id.startsWith('fallback-')) {
        try {
          const detailRes = await fetch(`https://dev.to/api/articles/${article.id}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (detailData.body_html) {
              article.bodyHtml = detailData.body_html;
              modalBodyContent.innerHTML = detailData.body_html;
            }
          }
        } catch (e) {
          console.warn('본문 상세 조회 실패, 요약문 유지:', e);
        }
      }
    }

    // 모달 표시
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
  }

  // 모달 닫기
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // 11. 이벤트 리스너 바인딩

  // 11-1. 폼 제출 ('뉴스보기' 버튼 클릭)
  topicForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const checkedInputs = topicForm.querySelectorAll('input[name="topic"]:checked');
    selectedTopics = Array.from(checkedInputs).map(cb => cb.value);
    loadInitialNews();
  });

  // 11-2. 뉴스 피드 내 '읽기' 버튼 클릭 위임
  newsFeed.addEventListener('click', (e) => {
    const readBtn = e.target.closest('.btn-read');
    if (!readBtn) return;
    const articleId = readBtn.dataset.id;
    if (articleId) {
      openArticleModal(articleId);
    }
  });

  // 11-3. 모달 닫기 이벤트 (닫기 버튼, 배경 클릭, ESC 키)
  modalCloseBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  // 11-4. 무한 스크롤 IntersectionObserver 설정
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMoreArticles();
    }
  }, {
    root: null,
    rootMargin: '150px', // 바닥에 도달하기 150px 전 미리 로드
    threshold: 0.1
  });

  observer.observe(scrollSentinel);

  // 12. 최초 페이지 접속 시 기본 선택된 주제로 뉴스 1회 자동 로드
  loadInitialNews();
});
