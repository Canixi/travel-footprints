/* =========================================================
   我的旅行足迹 · 应用逻辑
   依赖：Leaflet、topojson-client、data/trips.json、data/world-110m.json
   ========================================================= */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const HOME = { city: '芜湖', lat: 31.3525, lng: 118.4331 };

  const state = {
    trips: [],
    years: [],
    filter: 'all',
    selectedId: null,
    noteTripId: null,
    detailId: null,
    detailList: [],
    detailIndex: -1,
    currentPhotos: [],
    lightboxPhotos: [],
    lightboxIndex: 0,
    lastLightboxFocus: null,
    lastFocus: null,
    map: null,
    markerLayer: null,
    routeLayer: null,
    markers: new Map()
  };

  const els = {
    kicker: document.getElementById('kicker'),
    filters: document.getElementById('filters'),
    entries: document.getElementById('entries'),
    foot: document.getElementById('journal-foot'),
    statCities: document.getElementById('stat-cities'),
    statCountries: document.getElementById('stat-countries'),
    statKm: document.getElementById('stat-km'),
    mapNote: document.getElementById('map-note'),
    noteDate: document.getElementById('note-date'),
    noteText: document.getElementById('note-text'),
    viewAll: document.getElementById('view-all'),
    detail: document.getElementById('detail'),
    detailCover: document.getElementById('detail-cover'),
    detailChar: document.getElementById('detail-char'),
    detailCap: document.getElementById('detail-cap'),
    detailKicker: document.getElementById('detail-kicker'),
    detailTitle: document.getElementById('detail-title'),
    detailSubtitle: document.getElementById('detail-subtitle'),
    detailIndex: document.getElementById('detail-index'),
    detailStory: document.getElementById('detail-story'),
    detailLocation: document.getElementById('detail-location'),
    detailDistance: document.getElementById('detail-distance'),
    detailTags: document.getElementById('detail-tags'),
    detailClose: document.getElementById('detail-close'),
    detailPrev: document.getElementById('detail-prev'),
    detailNext: document.getElementById('detail-next'),
    detailGallery: document.getElementById('detail-gallery'),
    detailGalleryGrid: document.getElementById('detail-gallery-grid'),
    detailPhotoCount: document.getElementById('detail-photo-count'),
    lightbox: document.getElementById('lightbox'),
    lightboxImg: document.getElementById('lightbox-img'),
    lightboxCaption: document.getElementById('lightbox-caption'),
    lightboxClose: document.getElementById('lightbox-close'),
    lightboxPrev: document.getElementById('lightbox-prev'),
    lightboxNext: document.getElementById('lightbox-next'),
    lightboxCounter: document.getElementById('lightbox-counter')
  };

  // 开场加载：等旅行数据和世界地图都就绪后再退场
  var introGate = { trips: false, map: false, stats: null };

  function introCheckpoint(part, stats) {
    introGate[part] = true;
    if (part === 'trips') introGate.stats = stats || null;
    if (!introGate.trips || !introGate.map) return;
    if (window.TravelIntro && typeof window.TravelIntro.ready === 'function') {
      window.TravelIntro.ready(introGate.stats);
    }
  }

  init();

  function init() {
    bindEvents();
    try {
      initMap();
    } catch (err) {
      console.error('地图初始化失败：', err);
      introCheckpoint('map');
    }
    loadTrips();
  }

  /* ---------------- 数据 ---------------- */

  function loadTrips() {
    fetch('data/trips.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.trips)) throw new Error('缺少 trips 数组');

        state.trips = data.trips
          .filter(function (t) {
            return t && t.id && Number.isFinite(Number(t.lat)) && Number.isFinite(Number(t.lng));
          })
          .map(function (t) {
            var copy = Object.assign({}, t);
            copy.lat = Number(t.lat);
            copy.lng = Number(t.lng);
            copy.photos = normalizePhotos(t.photos);
            if (!copy.cover && copy.photos.length) copy.cover = copy.photos[0].src;
            return copy;
          })
          .sort(function (a, b) {
            return String(a.start || '').localeCompare(String(b.start || ''));
          });

        state.years = Array.from(new Set(state.trips.map(function (t) {
          return String(t.start || '').slice(0, 4);
        }).filter(Boolean))).sort(function (a, b) { return b.localeCompare(a); });

        renderFilters();
        renderAll();
        updateKicker(data.site);
        handleInitialHash();

        introCheckpoint('trips', {
          cities: new Set(state.trips.map(function (t) { return t.city || '未填写'; })).size,
          countries: new Set(state.trips.map(function (t) { return t.country || '未填写'; })).size,
          km: Math.round(totalDistance(state.trips))
        });
      })
      .catch(function (err) {
        console.error('加载 trips.json 失败：', err);
        els.entries.textContent = '';
        var msg = document.createElement('p');
        msg.className = 'journal-msg error';
        msg.appendChild(document.createTextNode('手账没能打开。请确认 '));
        var code = document.createElement('code');
        code.textContent = 'data/trips.json';
        msg.appendChild(code);
        msg.appendChild(document.createTextNode(' 存在且格式正确，然后刷新页面。'));
        els.entries.appendChild(msg);
        els.filters.textContent = '';
        els.foot.textContent = '等待数据…';
        setStats(null);
        updateNote(null);
        introCheckpoint('trips');
      });
  }

  function getFilteredTrips() {
    if (state.filter === 'all') return state.trips.slice();

    if (state.filter === 'pre2023') {
      return state.trips.filter(function (t) {
        return Number(String(t.start || '').slice(0, 4)) <= 2022;
      });
    }

    return state.trips.filter(function (t) {
      return String(t.start || '').slice(0, 4) === state.filter;
    });
  }

  function findTrip(id) {
    return state.trips.find(function (t) { return t.id === id; }) || null;
  }

  /* ---------------- 渲染 ---------------- */

  function renderFilters() {
    els.filters.textContent = '';

    var items = [{ key: 'all', label: '全部' }];
    var hasGroupedOld = false;

    state.years.forEach(function (y) {
      if (Number(y) > 2022) {
        items.push({ key: y, label: y });
      } else {
        hasGroupedOld = true;
      }
    });

    if (hasGroupedOld) {
      items.push({ key: 'pre2023', label: '2022及以前' });
    }

    items.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (state.filter === item.key ? ' active' : '');
      btn.textContent = item.label;
      btn.dataset.year = item.key;
      btn.setAttribute('aria-pressed', String(state.filter === item.key));
      btn.addEventListener('click', function () { setFilter(item.key); });
      els.filters.appendChild(btn);
    });
  }

  function setFilter(year) {
    if (state.filter === year) return;
    state.filter = year;
    renderFilters();
    renderAll();
  }

  function renderAll() {
    var filtered = getFilteredTrips();

    if (state.selectedId && !filtered.some(function (t) { return t.id === state.selectedId; })) {
      state.selectedId = null;
    }

    setStats(filtered);
    renderEntries(filtered);
    updateNote(currentTripForNote(filtered));
    renderMap(filtered);
    updateFoot(filtered);
  }

  function currentTripForNote(filtered) {
    if (state.selectedId) {
      var selected = filtered.find(function (t) { return t.id === state.selectedId; });
      if (selected) return selected;
    }
    return filtered.length ? filtered[filtered.length - 1] : null;
  }

  function setStats(trips) {
    if (!trips) {
      els.statCities.textContent = '—';
      els.statCountries.textContent = '—';
      els.statKm.textContent = '—';
      return;
    }
    var cities = new Set(trips.map(function (t) { return t.city || '未填写'; }));
    var countries = new Set(trips.map(function (t) { return t.country || '未填写'; }));
    els.statCities.textContent = String(cities.size);
    els.statCountries.textContent = String(countries.size);
    els.statKm.textContent = formatNumber(totalDistance(trips));
  }

  function renderEntries(trips) {
    els.entries.textContent = '';

    if (!trips.length) {
      var empty = document.createElement('p');
      empty.className = 'journal-msg';
      empty.textContent = state.trips.length
        ? '这个年份还没有留下足迹。换个年份，或者开始计划下一次出发。'
        : '还没有旅程记录。打开 data/trips.json，写下第一站吧。';
      els.entries.appendChild(empty);
      return;
    }

    var newestFirst = trips.slice().sort(function (a, b) {
      return String(b.start || '').localeCompare(String(a.start || ''));
    });

    newestFirst.forEach(function (trip) {
      els.entries.appendChild(createCard(trip));
    });
  }

  function createCard(trip) {
    var card = document.createElement('article');
    card.className = 'polaroid' + (trip.id === state.selectedId ? ' active' : '');
    card.dataset.tripId = trip.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', '阅读 ' + trip.city + (trip.title ? ' · ' + trip.title : '') + ' 的旅行笔记');

    var tape = document.createElement('span');
    tape.className = 'tape';
    card.appendChild(tape);

    var photo = document.createElement('div');
    photo.className = 'photo';
    applyCover(photo, trip);

    var charEl = document.createElement('span');
    charEl.className = 'photo-char';
    charEl.textContent = firstChar(trip.city);
    photo.appendChild(charEl);

    var cap = document.createElement('span');
    cap.className = 'photo-cap';
    cap.textContent = (trip.cityEn || trip.city || '').toUpperCase() + ' · ' + formatMonth(trip.start);
    photo.appendChild(cap);
    card.appendChild(photo);

    var body = document.createElement('div');
    body.className = 'polaroid-body';

    var top = document.createElement('div');
    top.className = 'entry-top';
    var h2 = document.createElement('h2');
    h2.textContent = trip.city || '未命名';
    var time = document.createElement('time');
    time.dateTime = trip.start || '';
    time.textContent = formatMonth(trip.start);
    top.appendChild(h2);
    top.appendChild(time);

    var excerpt = document.createElement('p');
    excerpt.textContent = trip.excerpt || '';

    var bottom = document.createElement('div');
    bottom.className = 'entry-bottom';

    var tags = document.createElement('div');
    tags.className = 'tags';
    renderTags(tags, trip.tags, true);

    var read = document.createElement('span');
    read.className = 'read-link';
    read.textContent = '阅读笔记 →';

    bottom.appendChild(tags);
    bottom.appendChild(read);

    body.appendChild(top);

    if (trip.title) {
      var subtitle = document.createElement('p');
      subtitle.className = 'entry-title';
      subtitle.textContent = trip.title;
      body.appendChild(subtitle);
    }

    body.appendChild(excerpt);
    body.appendChild(bottom);
    card.appendChild(body);

    return card;
  }

  function applyCover(el, trip) {
    var colors = Array.isArray(trip.coverGradient) && trip.coverGradient.length >= 2
      ? trip.coverGradient
      : ['#c9b795', '#8a7153', '#5c4b38'];

    if (trip.cover) {
      el.classList.add('has-cover');
      el.style.background = 'url("' + String(trip.cover).replace(/"/g, '%22') + '") center / cover no-repeat';
    } else {
      el.classList.remove('has-cover');
      el.style.background = 'linear-gradient(150deg, ' + colors[0] + ' 0%, ' +
        colors[1] + ' 48%, ' + (colors[2] || colors[1]) + ' 100%)';
    }
  }

  function renderTags(container, tags, withHash) {
    container.textContent = '';
    (Array.isArray(tags) ? tags : []).forEach(function (tag) {
      var span = document.createElement('span');
      span.textContent = withHash ? '#' + tag : tag;
      container.appendChild(span);
    });
  }

  function normalizePhotos(photos) {
    if (!Array.isArray(photos)) return [];
    return photos.map(function (photo) {
      if (typeof photo === 'string') return { src: photo, thumb: photo, caption: '' };
      if (!photo || !photo.src) return null;
      return {
        src: photo.src,
        thumb: photo.thumb || photo.src,
        caption: photo.caption || ''
      };
    }).filter(Boolean);
  }

  function updateFoot(trips) {
    if (!trips.length) {
      els.foot.textContent = '0 段旅程 · 等待下一次出发';
      return;
    }
    els.foot.textContent = trips.length + ' 段旅程 · ' + formatNumber(totalDistance(trips)) + ' 公里';
  }

  function updateKicker(site) {
    if (!state.trips.length) return;
    var firstYear = String(state.trips[0].start || '').slice(0, 4);
    var lastYear = String(state.trips[state.trips.length - 1].start || '').slice(0, 4);
    var title = (site && site.subtitle) ? site.subtitle : 'MY TRAVEL JOURNAL';
    var range = firstYear === lastYear ? firstYear : firstYear + ' — ' + lastYear;
    els.kicker.textContent = title + ' · ' + range;
  }

  function updateNote(trip) {
    els.mapNote.hidden = state.filter !== 'all';

    if (!trip) {
      state.noteTripId = null;
      els.mapNote.disabled = true;
      els.noteDate.textContent = '旅行手账';
      els.noteText.textContent = state.trips.length
        ? '这个年份还没有留下足迹。'
        : '还没有旅程记录，去留下第一个坐标吧。';
      els.mapNote.setAttribute('aria-label', '当前没有可打开的旅行笔记');
      return;
    }

    state.noteTripId = trip.id;
    els.mapNote.disabled = false;
    els.noteDate.textContent = formatRange(trip) + ' · ' + trip.city;
    els.noteText.textContent = trip.excerpt || '';
    els.mapNote.setAttribute('aria-label', '打开 ' + trip.city + ' 的旅行笔记');
  }

  /* ---------------- 地图 ---------------- */

  function initMap() {
    if (typeof L === 'undefined') throw new Error('Leaflet 未加载');

    state.map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      minZoom: 1.5,
      maxZoom: 7,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      worldCopyJump: false,
      maxBounds: [[-75, -200], [88, 200]],
      maxBoundsViscosity: 0.7
    });

    state.map.createPane('countriesPane');
    state.map.getPane('countriesPane').style.zIndex = 390;
    state.map.createPane('routePane');
    state.map.getPane('routePane').style.zIndex = 410;

    state.map.setView([30, 95], 3);
    L.control.zoom({ position: 'bottomright' }).addTo(state.map);

    state.map.on('zoomend', updateLabelDensity);
    updateLabelDensity();

    var attribution = L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(state.map);
    attribution.addAttribution('地图数据 © Natural Earth');

    state.markerLayer = L.layerGroup().addTo(state.map);
    state.routeLayer = L.layerGroup().addTo(state.map);

    fetch('data/world-110m.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (topo) {
        if (typeof topojson === 'undefined') throw new Error('topojson-client 未加载');
        var countries = topojson.feature(topo, topo.objects.countries);
        L.geoJSON(countries, {
          className: 'country',
          pane: 'countriesPane',
          style: { fill: true, fillOpacity: 1, color: 'transparent', weight: 0.7, interactive: false }
        }).addTo(state.map);
        drawGraticule();
        introCheckpoint('map');
      })
      .catch(function (err) {
        console.warn('世界地图数据加载失败，仅显示足迹点：', err);
        introCheckpoint('map');
      });
  }

  function drawGraticule() {
    var opts = { className: 'graticule', weight: 0.6, interactive: false, pane: 'countriesPane' };
    for (var lng = -180; lng <= 180; lng += 20) {
      L.polyline([[-60, lng], [84, lng]], opts).addTo(state.map);
    }
    for (var lat = -60; lat <= 80; lat += 20) {
      L.polyline([[lat, -180], [lat, 180]], opts).addTo(state.map);
    }
  }

  function renderMap(trips) {
    if (!state.map) return;

    state.markerLayer.clearLayers();
    state.routeLayer.clearLayers();
    state.markers.clear();

    var destinations = new Map();
    trips.forEach(function (t) {
      if (t.city === HOME.city) return;
      destinations.set(t.city, t);
    });

    destinations.forEach(function (t) {
      L.polyline([[HOME.lat, HOME.lng], [t.lat, t.lng]], {
        className: 'route',
        color: '#d4552d',
        weight: 1.4,
        dashArray: '3 7',
        pane: 'routePane',
        interactive: false
      }).addTo(state.routeLayer);
    });

    var homeIcon = L.divIcon({
      className: 'city-pin home-pin',
      html: '<span class="pin-dot"></span><span class="pin-label"><b>芜湖</b><i>家</i></span>',
      iconSize: [0, 0]
    });
    var homeMarker = L.marker([HOME.lat, HOME.lng], {
      icon: homeIcon,
      keyboard: false,
      interactive: false,
      title: '芜湖 · 家',
      alt: '芜湖 家',
      zIndexOffset: 1000
    });
    homeMarker.addTo(state.markerLayer);
    state.markers.set(HOME.city, homeMarker);
    var homeEl = homeMarker.getElement();
    if (homeEl) homeEl.dataset.preferred = 'bottom';

    var groups = new Map();
    trips.forEach(function (trip) {
      var key = trip.city || trip.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(trip);
    });

    groups.forEach(function (groupTrips) {
      var latest = groupTrips[groupTrips.length - 1];
      if (latest.city === HOME.city) return;
      var years = Array.from(new Set(groupTrips.map(function (t) {
        return String(t.start || '').slice(0, 4);
      }).filter(Boolean))).sort();

      var yearLabel;
      if (years.length > 1) {
        yearLabel = years[0] + '—' + years[years.length - 1];
      } else {
        yearLabel = (years[0] || '') + (groupTrips.length > 1 ? ' · ' + groupTrips.length + ' 次' : '');
      }

      var sideClass = latest.labelSide === 'left'
        ? ' side-left'
        : latest.labelSide === 'bottom'
          ? ' side-bottom'
          : latest.labelSide === 'top'
            ? ' side-top'
            : '';

      var icon = L.divIcon({
        className: 'city-pin' + sideClass,
        html: '<span class="pin-dot"></span><span class="pin-label"><b>' +
          escapeHtml(latest.city) + '</b><i class="pin-year">' + escapeHtml(yearLabel) + '</i></span>',
        iconSize: [0, 0]
      });

      var marker = L.marker([latest.lat, latest.lng], {
        icon: icon,
        keyboard: true,
        title: latest.city + (groupTrips.length > 1 ? ' · ' + groupTrips.length + ' 次到访' : ''),
        alt: latest.city + ' ' + yearLabel,
        riseOnHover: true
      });

      marker.on('click', function () { openDetail(latest.id); });
      marker.addTo(state.markerLayer);
      state.markers.set(latest.city, marker);

      var markerEl = marker.getElement();
      if (markerEl) markerEl.dataset.preferred = latest.labelSide || '';
    });

    fitMap(trips);
    markActiveMarker();
    updateLabelDensity();
  }

  function updateLabelDensity() {
    if (!state.map) return;
    var size = state.map.getSize();
    var pinCount = document.querySelectorAll('.city-pin').length;
    var compact = state.map.getZoom() < 5.25;
    var minimal = size.x < 1000 && pinCount > 8;
    var container = state.map.getContainer();
    container.classList.toggle('labels-compact', compact);
    container.classList.toggle('labels-minimal', minimal);
    layoutLabels();
  }

  function layoutLabels() {
    if (!state.map) return;

    var mapRect = state.map.getContainer().getBoundingClientRect();
    var placed = [];

    ['.map-note', '.view-all', '.compass', '.leaflet-control-zoom'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      var r = el.getBoundingClientRect();
      if (r.width && r.height) placed.push(r);
    });

    var selectedTrip = state.selectedId ? findTrip(state.selectedId) : null;
    var selectedCity = selectedTrip ? selectedTrip.city : null;
    var pins = Array.from(document.querySelectorAll('.city-pin'));
    var classes = ['', 'side-left', 'side-top', 'side-bottom'];

    pins.sort(function (a, b) {
      var an = a.querySelector('.pin-label b');
      var bn = b.querySelector('.pin-label b');
      var asel = an && an.textContent === selectedCity ? 1 : 0;
      var bsel = bn && bn.textContent === selectedCity ? 1 : 0;
      return bsel - asel;
    });

    pins.forEach(function (pin) {
      var label = pin.querySelector('.pin-label');
      if (!label) return;

      var preferred = pin.dataset.preferred || '';
      var preferredClass = preferred === 'left' ? 'side-left'
        : preferred === 'bottom' ? 'side-bottom'
          : preferred === 'top' ? 'side-top'
            : '';
      var order = [preferredClass].concat(classes.filter(function (c) {
        return c !== preferredClass;
      }));

      var bestClass = '';
      var bestOverlap = Infinity;
      var bestRect = null;

      order.forEach(function (cls) {
        pin.classList.remove('side-left', 'side-top', 'side-bottom');
        if (cls) pin.classList.add(cls);

        var r = label.getBoundingClientRect();
        var inside = r.left >= mapRect.left + 4 && r.right <= mapRect.right - 4 &&
          r.top >= mapRect.top + 4 && r.bottom <= mapRect.bottom - 4;
        var overlap = 0;
        var gap = 5;

        placed.forEach(function (o) {
          var w = Math.min(r.right, o.right + gap) - Math.max(r.left, o.left - gap);
          var h = Math.min(r.bottom, o.bottom + gap) - Math.max(r.top, o.top - gap);
          if (w > 0 && h > 0) overlap += w * h;
        });

        if (!inside) overlap += 1000000;

        if (overlap < bestOverlap) {
          bestOverlap = overlap;
          bestClass = cls;
          bestRect = r;
        }
      });

      pin.classList.remove('side-left', 'side-top', 'side-bottom');
      if (bestClass) pin.classList.add(bestClass);
      if (bestRect) placed.push(bestRect);
    });
  }

  function fitMap(trips) {
    if (!state.map) return;

    if (!trips.length) {
      state.map.setView([30, 95], 3, { animate: false });
      return;
    }

    var points = trips.map(function (t) { return [t.lat, t.lng]; });
    points.push([HOME.lat, HOME.lng]);

    var bounds = L.latLngBounds(points);
    var size = state.map.getSize();
    var narrow = size.x < 720;
    var padLeft = narrow ? 28 : 70;
    var padTop = narrow ? 56 : 70;
    var padRight = narrow ? 60 : 70;

    state.map.fitBounds(bounds, {
      paddingTopLeft: [padLeft, padTop],
      paddingBottomRight: [padRight, padTop],
      maxZoom: 5.5,
      animate: false
    });
  }

  function markActiveMarker() {
    var selectedTrip = state.selectedId ? findTrip(state.selectedId) : null;
    var selectedCity = selectedTrip ? selectedTrip.city : null;

    state.markers.forEach(function (marker, city) {
      var el = marker.getElement();
      if (!el) return;
      el.classList.toggle('is-active', city === selectedCity);
    });
  }

  /* ---------------- 选中与详情 ---------------- */

  function selectTrip(id, options) {
    options = options || {};
    var trip = findTrip(id);
    if (!trip) return;

    state.selectedId = id;
    markActiveCard();
    markActiveMarker();
    updateNote(trip);

    if (options.fly !== false && state.map) {
      var targetZoom = Math.max(state.map.getZoom(), 4);
      if (reduceMotion) {
        state.map.setView([trip.lat, trip.lng], targetZoom);
      } else {
        state.map.flyTo([trip.lat, trip.lng], targetZoom, { duration: 0.8 });
      }
    }

    if (options.scrollCard !== false) {
      var cards = els.entries.querySelectorAll('.polaroid');
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].dataset.tripId === id) {
          cards[i].scrollIntoView({
            block: 'nearest',
            behavior: reduceMotion ? 'auto' : 'smooth'
          });
          break;
        }
      }
    }
  }

  function markActiveCard() {
    var cards = els.entries.querySelectorAll('.polaroid');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('active', cards[i].dataset.tripId === state.selectedId);
    }
  }

  function openDetail(id, options) {
    options = options || {};
    var trip = findTrip(id);
    if (!trip) return;

    var list = getFilteredTrips();
    if (!list.some(function (t) { return t.id === id; })) list = state.trips.slice();
    var index = list.findIndex(function (t) { return t.id === id; });
    if (index < 0) return;

    selectTrip(id, { fly: true, scrollCard: false });

    state.detailId = id;
    state.detailList = list;
    state.detailIndex = index;

    var wasHidden = els.detail.hidden;
    var activeBefore = document.activeElement;
    if (wasHidden) {
      state.lastFocus = document.activeElement;
      els.detail.hidden = false;
    }

    populateDetail(trip, list, index);

    if (options.updateHash !== false) {
      history.replaceState(null, '', '#' + encodeURIComponent(id));
    }

    if (wasHidden) {
      els.detailClose.focus({ preventScroll: true });
    } else if (activeBefore && els.detail.contains(activeBefore) && !activeBefore.disabled) {
      activeBefore.focus({ preventScroll: true });
    } else if (activeBefore === els.detailNext && !els.detailPrev.disabled) {
      els.detailPrev.focus({ preventScroll: true });
    } else if (activeBefore === els.detailPrev && !els.detailNext.disabled) {
      els.detailNext.focus({ preventScroll: true });
    } else {
      els.detailClose.focus({ preventScroll: true });
    }
  }

  function populateDetail(trip, list, index) {
    applyCover(els.detailCover, trip);

    els.detailChar.textContent = firstChar(trip.city);
    els.detailCap.textContent = (trip.cityEn || trip.city || '').toUpperCase() + ' · ' + formatMonth(trip.start);

    var kickerParts = [];
    if (trip.countryEn) kickerParts.push(trip.countryEn.toUpperCase());
    if (trip.country) kickerParts.push(trip.country);
    kickerParts.push(formatRange(trip));
    els.detailKicker.textContent = kickerParts.join(' · ');

    els.detailTitle.textContent = trip.city || '未命名';
    els.detailSubtitle.textContent = trip.title || '';
    els.detailIndex.textContent = pad2(index + 1) + ' / ' + pad2(list.length);
    els.detailStory.textContent = trip.story || trip.excerpt || '';

    els.detailLocation.textContent = trip.location || buildLocation(trip);

    if (index > 0) {
      els.detailDistance.textContent = formatNumber(haversineKm(list[index - 1], trip)) + ' km';
    } else {
      els.detailDistance.textContent = '—';
    }

    renderTags(els.detailTags, trip.tags, true);
    renderGallery(trip.photos);

    var prevTrip = index > 0 ? list[index - 1] : null;
    var nextTrip = index < list.length - 1 ? list[index + 1] : null;

    els.detailPrev.disabled = !prevTrip;
    els.detailNext.disabled = !nextTrip;
    els.detailPrev.textContent = prevTrip ? '← 上一站 · ' + prevTrip.city : '← 上一站';
    els.detailNext.textContent = nextTrip ? '下一站 · ' + nextTrip.city + ' →' : '下一站 →';
    els.detailPrev.dataset.targetId = prevTrip ? prevTrip.id : '';
    els.detailNext.dataset.targetId = nextTrip ? nextTrip.id : '';

    var body = els.detail.querySelector('.detail-body');
    if (body) body.scrollTop = 0;
  }

  function renderGallery(photos) {
    els.detailGalleryGrid.textContent = '';
    state.currentPhotos = Array.isArray(photos) ? photos : [];

    if (state.currentPhotos.length < 2) {
      els.detailGallery.hidden = true;
      return;
    }

    els.detailGallery.hidden = false;
    els.detailPhotoCount.textContent = ' · ' + state.currentPhotos.length + ' 张';

    state.currentPhotos.forEach(function (photo, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gallery-item';
      btn.setAttribute('aria-label', '查看照片：' + (photo.caption || '第 ' + (index + 1) + ' 张'));

      var img = document.createElement('img');
      img.src = photo.thumb || photo.src;
      img.alt = photo.caption || ('旅行照片 ' + (index + 1));
      img.loading = 'lazy';
      img.decoding = 'async';
      btn.appendChild(img);

      if (photo.caption) {
        var cap = document.createElement('span');
        cap.className = 'gallery-caption';
        cap.textContent = photo.caption;
        btn.appendChild(cap);
      }

      btn.addEventListener('click', function () { openLightbox(index); });
      els.detailGalleryGrid.appendChild(btn);
    });
  }

  function openLightbox(index) {
    if (!state.currentPhotos.length) return;
    state.lightboxPhotos = state.currentPhotos;
    state.lightboxIndex = index;
    state.lastLightboxFocus = document.activeElement;
    els.lightbox.hidden = false;
    updateLightbox();
    els.lightboxClose.focus({ preventScroll: true });
  }

  function updateLightbox() {
    var photos = state.lightboxPhotos;
    if (!photos.length) return;
    var photo = photos[state.lightboxIndex];
    els.lightboxImg.src = photo.src;
    els.lightboxImg.alt = photo.caption || '';
    els.lightboxCaption.textContent = photo.caption || '';
    els.lightboxCounter.textContent = (state.lightboxIndex + 1) + ' / ' + photos.length;
  }

  function stepLightbox(delta) {
    var n = state.lightboxPhotos.length;
    if (n < 2) return;
    state.lightboxIndex = (state.lightboxIndex + delta + n) % n;
    updateLightbox();
  }

  function closeLightbox(options) {
    options = options || {};
    if (els.lightbox.hidden) return;
    els.lightbox.hidden = true;
    els.lightboxImg.src = '';
    if (options.restoreFocus !== false && state.lastLightboxFocus && document.contains(state.lastLightboxFocus)) {
      state.lastLightboxFocus.focus({ preventScroll: true });
    }
    state.lastLightboxFocus = null;
  }

  function closeDetail(options) {
    options = options || {};
    if (els.detail.hidden) return;

    if (!els.lightbox.hidden) closeLightbox({ restoreFocus: false });

    els.detail.hidden = true;
    state.detailId = null;

    if (options.updateHash !== false) {
      history.replaceState(null, '', location.pathname + location.search);
    }

    if (state.lastFocus && document.contains(state.lastFocus)) {
      state.lastFocus.focus({ preventScroll: true });
    }
    state.lastFocus = null;
  }

  function handleInitialHash() {
    var id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (err) { id = ''; }
    if (id && findTrip(id)) openDetail(id, { updateHash: false });
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    els.entries.addEventListener('click', function (e) {
      var card = e.target.closest('.polaroid');
      if (!card || !els.entries.contains(card)) return;
      openDetail(card.dataset.tripId);
    });

    els.entries.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.polaroid');
      if (!card) return;
      e.preventDefault();
      openDetail(card.dataset.tripId);
    });

    els.mapNote.addEventListener('click', function () {
      if (state.noteTripId) openDetail(state.noteTripId);
    });

    els.viewAll.addEventListener('click', function () {
      fitMap(getFilteredTrips());
    });

    els.detailClose.addEventListener('click', function () { closeDetail(); });

    var backdrop = els.detail.querySelector('[data-close-detail]');
    if (backdrop) backdrop.addEventListener('click', function () { closeDetail(); });

    els.detailPrev.addEventListener('click', function () {
      var target = els.detailPrev.dataset.targetId;
      if (target) openDetail(target);
    });

    els.detailNext.addEventListener('click', function () {
      var target = els.detailNext.dataset.targetId;
      if (target) openDetail(target);
    });

    els.lightboxClose.addEventListener('click', function () { closeLightbox(); });

    var lightboxBackdrop = els.lightbox.querySelector('[data-close-lightbox]');
    if (lightboxBackdrop) {
      lightboxBackdrop.addEventListener('click', function () { closeLightbox(); });
    }

    els.lightboxPrev.addEventListener('click', function () { stepLightbox(-1); });
    els.lightboxNext.addEventListener('click', function () { stepLightbox(1); });

    document.addEventListener('keydown', function (e) {
      if (!els.lightbox.hidden) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeLightbox();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stepLightbox(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          stepLightbox(1);
        } else if (e.key === 'Tab') {
          trapLightboxFocus(e);
        }
        return;
      }

      if (els.detail.hidden) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeDetail();
        return;
      }
      if (e.key === 'Tab') {
        trapFocus(e);
      }
    });

    window.addEventListener('hashchange', function () {
      var id = '';
      try { id = decodeURIComponent(location.hash.slice(1)); } catch (err) { id = ''; }
      if (id && findTrip(id)) {
        if (state.detailId !== id) openDetail(id, { updateHash: false });
      } else if (!id && state.detailId) {
        closeDetail({ updateHash: false });
      }
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (state.map) {
          state.map.invalidateSize();
          updateLabelDensity();
        }
      }, 150);
    });
  }

  function trapFocus(e) {
    var focusables = els.detail.querySelectorAll('button:not([disabled])');
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function trapLightboxFocus(e) {
    var focusables = els.lightbox.querySelectorAll('button');
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------------- 工具函数 ---------------- */

  function firstChar(str) {
    var chars = Array.from(String(str || '·'));
    return chars.length ? chars[0] : '·';
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }

  function haversineKm(a, b) {
    var R = 6371;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function totalDistance(trips) {
    var destinations = new Map();
    trips.forEach(function (t) {
      if (t.city !== HOME.city) destinations.set(t.city, t);
    });

    var total = 0;
    destinations.forEach(function (t) {
      total += haversineKm(HOME, t);
    });
    return total;
  }

  function formatMonth(str) {
    if (!str) return '—';
    var m = String(str).match(/^(\d{4})-(\d{2})/);
    return m ? m[1] + '.' + m[2] : String(str);
  }

  function formatDate(str) {
    if (!str) return '—';
    return String(str).slice(0, 10).replace(/-/g, '.');
  }

  function formatRange(trip) {
    var start = formatDate(trip.start);
    if (!trip.end) return start;
    var end = formatDate(trip.end);
    if (end === start) return start;
    if (end.slice(0, 5) === start.slice(0, 5)) {
      return start + ' — ' + end.slice(5);
    }
    return start + ' — ' + end;
  }

  function buildLocation(trip) {
    var parts = [trip.region, trip.city].filter(Boolean);
    return parts.length ? parts.join(' · ') : '—';
  }
})();
