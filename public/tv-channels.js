// Official Vietnam TV channel registry.
// This module only stores metadata and links to OFFICIAL broadcaster pages.
// It never stores or serves a direct video/stream URL.
const OFFICIAL_TV_CHANNELS = [
  { id: 'vtv1', name: 'VTV1', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtv.vn/truyen-hinh-truc-tuyen/vtv1.htm', access: 'official', enabled: true },
  { id: 'vtv2', name: 'VTV2', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtvgo.vn/channel/2', access: 'official', enabled: true },
  { id: 'vtv3', name: 'VTV3', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtv.vn/truyen-hinh-truc-tuyen/vtv3.html', access: 'official', enabled: true },
  { id: 'vtv4', name: 'VTV4', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtvgo.vn/channel/4', access: 'official', enabled: true },
  { id: 'vtv5', name: 'VTV5', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtvgo.vn/channel/5', access: 'official', enabled: true },
  { id: 'vtv5-taynguyen', name: 'VTV5 Tây Nguyên', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtvgo.vn/channel/6', access: 'official', enabled: true },
  { id: 'vtv5-taynambo', name: 'VTV5 Tây Nam Bộ', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtvgo.vn/channel/7', access: 'official', enabled: true },
  { id: 'vtv7', name: 'VTV7', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtvgo.vn/channel/35', access: 'official', enabled: true },
  { id: 'vtv8', name: 'VTV8', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtvgo.vn/channel/36', access: 'official', enabled: true },
  { id: 'vtv9', name: 'VTV9', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtvgo.vn/channel/9', access: 'official', enabled: true },
  { id: 'vtv-cantho', name: 'VTV Cần Thơ', provider: 'VTV', category: 'VTV', sourceType: 'official_web', sourceUrl: 'https://vtvgo.vn/channel/37', access: 'official', enabled: true },
  { id: 'htv7', name: 'HTV7', provider: 'HTV', category: 'HTV', sourceType: 'official_web', sourceUrl: 'https://www.htv.com.vn/truc-tuyen?channel=1', access: 'official', enabled: true },
  { id: 'htv9', name: 'HTV9', provider: 'HTV', category: 'HTV', sourceType: 'official_web', sourceUrl: 'https://www.htv.com.vn/truc-tuyen?channel=2', access: 'official', enabled: true },
  { id: 'htv-key', name: 'HTV Key', provider: 'HTV', category: 'HTV', sourceType: 'official_web', sourceUrl: 'https://www.htv.com.vn/truc-tuyen', access: 'official', enabled: true },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OFFICIAL_TV_CHANNELS;
}
