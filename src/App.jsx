import React, { useState, useRef, useEffect } from 'react';
import { 
  MapPin, Calendar, Clock, Train, Plane, Bed, Utensils, 
  Camera, Ticket, ShoppingBag, Sun, CloudRain, Wind, 
  ChevronDown, ChevronUp, Plus, Phone, FileText, Check, 
  Navigation, Map as MapIcon, Info, Image as ImageIcon,
  Umbrella, Loader2, X, Cloud, Snowflake, Trash2,
  MessageCircle, Copy, CheckCheck, Volume2, ZoomIn,
  Pencil, Save, MoreVertical
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

// --- FIREBASE SETUP ---
let app, auth, db;
try {
  let firebaseConfig = {};
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  }
  
  if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.warn("Firebase 初始化受限:", error);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 靜態翻譯辭典 (Mock Database) ---
const TRANSLATION_DICT = [
  { keywords: ['廁所', '洗手間', '化妝室', '尿', '大便'], zh: '請問廁所在哪裡？', jp: 'トイレはどこですか？', romaji: 'Toire wa doko desu ka?', tip: '日本很多便利商店都有提供免費廁所喔！' },
  { keywords: ['拍照', '照相', '合照', '相機'], zh: '可以幫我拍照嗎？', jp: '写真を撮っていただけますか？', romaji: 'Shashin o totte itadakemasu ka?', tip: '把手機或相機遞給對方時，可以微笑加上這句。' },
  { keywords: ['結帳', '買單', '多少錢', '付錢', '帳單'], zh: '麻煩結帳，請問多少錢？', jp: 'お会計をお願いします。いくらですか？', romaji: 'Okaikei o onegai shimasu. Ikura desu ka?', tip: '在日本通常是在門口櫃檯結帳，較少在桌邊結帳。' },
  { keywords: ['迷路', '怎麼走', '路', '車站', '地圖'], zh: '我迷路了，請問到車站怎麼走？', jp: '道に迷ってしまいました。駅までどう行けばいいですか？', romaji: 'Michi ni mayotte shimaimashita. Eki made dou ikeba ii desu ka?', tip: '如果遇到警察局 (Kōban)，他們通常很樂意幫忙指路。' },
  { keywords: ['推薦', '好吃', '招牌', '人氣'], zh: '請問有推薦的餐點嗎？', jp: 'おすすめのメニューはありますか？', romaji: 'Osusume no menyū wa arimasu ka?', tip: '不知道吃什麼時，這句話非常實用！' },
  { keywords: ['水', '白開水', '冰水'], zh: '請給我一杯水。', jp: 'お水を一杯いただけますか？', romaji: 'Omizu o ippai itadakemasu ka?', tip: '日本餐廳通常會免費提供冰水 (Ohiya)。' },
  { keywords: ['免稅', '退稅', 'tax free'], zh: '請問這裡有免稅服務嗎？', jp: 'ここは免税できますか？', romaji: 'Koko wa menzei dekimasu ka?', tip: '結帳前記得先確認，並準備好護照。' },
  { keywords: ['袋子', '塑膠袋', '購物袋'], zh: '我不需要袋子，謝謝。', jp: '袋は結構です、ありがとうございます。', romaji: 'Fukuro wa kekkou desu, arigatou gozaimasu.', tip: '日本現在購物袋大多要收費喔。' },
  { keywords: ['謝謝', '感謝', '多謝'], zh: '非常感謝你！', jp: '本当にありがとうございます！', romaji: 'Hontou ni arigatou gozaimasu!', tip: '面帶微笑說出這句，是最棒的交流。' },
  { keywords: ['對不起', '抱歉', '不好意思'], zh: '非常抱歉 / 不好意思。', jp: '申し訳ありません / すみません。', romaji: 'Moushiwake arimasen / Sumimasen.', tip: '「Sumimasen」也可以用來引起店員注意。' },
  { keywords: ['打不開', '壞了', '不能用', '故障'], zh: '不好意思，這個好像壞了/不能用。', jp: 'すみません、これ壊れているみたいです。', romaji: 'Sumimasen, kore kowarete iru mitai desu.', tip: '飯店房間遇到設備問題時可以向櫃檯反應。' },
  { keywords: ['過敏', '不吃', '不要加', '忌口'], zh: '我對某些食物過敏。', jp: '私は食物アレルギーがあります。', romaji: 'Watashi wa shokumotsu arerugī ga arimasu.', tip: '如果有嚴重過敏，建議額外準備寫有過敏原的字卡。' },
];

const DEFAULT_TRANSLATION = {
  zh: '不好意思，我不太懂日文…。我現在用一下翻譯 App，能麻煩您稍等一下嗎？',
  jp: 'すみません、日本語がよく分からなくて…。今、翻訳アプリを使いますので、少し待っていただけますか？',
  romaji: 'Sumimasen, nihongo ga yoku wakaranakute... Ima, honyaku apuri o tsukaimasu node, sukoshi matte itadakemasu ka?',
  tip: '對方如果說了很長一串聽不懂的日文，可以直接秀出這張卡片。'
};

// --- 真實天氣 API (Open-Meteo 免金鑰) ---
const fetchRealWeather = async () => {
  try {
    // 抓取名古屋 (緯度 35.1815, 經度 136.9066) 未來 6 天的天氣
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.1815&longitude=136.9066&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo&forecast_days=6');
    if (!res.ok) throw new Error("天氣 API 呼叫失敗");
    const data = await res.json();

    // WMO 天氣代碼轉換
    const wmoToCondition = (code) => {
      if (code === 0 || code === 1) return { condition: 'Sunny', desc: '晴朗舒適', clothingHint: '薄長袖加上輕便外套' };
      if (code === 2 || code === 3 || code === 45 || code === 48) return { condition: 'Cloudy', desc: '多雲時晴', clothingHint: '洋蔥式穿搭，早晚微涼' };
      if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return { condition: 'Rain', desc: '陰雨綿綿', clothingHint: '建議帶雨傘及防風外套' };
      if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { condition: 'Snow', desc: '寒冷降雪', clothingHint: '嚴寒！厚羽絨衣、手套與毛帽' };
      return { condition: 'Sunny', desc: '晴朗舒適', clothingHint: '薄長袖加上輕便外套' };
    };

    const tripDates = ['4/21', '4/22', '4/23', '4/24', '4/25', '4/26'];
    const weekdays = ['二', '三', '四', '五', '六', '日'];

    return data.daily.time.map((timeStr, idx) => {
      const maxTemp = Math.round(data.daily.temperature_2m_max[idx]);
      const minTemp = Math.round(data.daily.temperature_2m_min[idx]);
      const codeInfo = wmoToCondition(data.daily.weathercode[idx]);

      return {
        day: tripDates[idx],
        weekday: weekdays[idx],
        temp: `${minTemp}° / ${maxTemp}°`,
        ...codeInfo
      };
    });
  } catch (error) {
    console.warn("真實天氣讀取失敗，將使用預設備用資料:", error);
    return null;
  }
};


// --- MOCK DATA ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const mockData = {
  "tripInfo": {
    "title": "✈️ 名古屋6天5夜放鬆之旅",
    "dates": "2026/04/21 - 2026/04/26",
    "themeColor": "#773690",
    "accentColor": "#A39D78"
  },
  "documents": [
    { title: "機票 (CHENG)", url: "https://drive.google.com/file/d/1m9BJ5Pdmh1uPSz1dFAdeRJhzz6MMH8qn/view?usp=drive_link", icon: "Plane" },
    { title: "機票 (CHEN)", url: "https://drive.google.com/file/d/15jhI5oWsA0yBXIwlgvwkoeXow6rMtRDK/view?usp=drive_link", icon: "Plane" },
    { title: "訂房 4/21-22", url: "https://drive.google.com/file/d/1AYxaJnuCWRs_tV-ZsTK1caoZGHBWEBXj/view?usp=sharing", icon: "Bed" },
    { title: "訂房 4/23-26", url: "https://drive.google.com/file/d/18VdPgAmOhLsfweGzor8N934oQbQUxVYG/view?usp=sharing", icon: "Bed" },
    { title: "兩日遊 4/22-23", url: "https://drive.google.com/file/d/1HeTP2KsnJpLL1FJvTzozuD0pf6sYMx0i/view?usp=sharing", icon: "MapPin" },
    { title: "吉卜力門票", url: "https://quickticket.moala.fun/books?id=ae3e6476-22f0-42c2-bbff-31677328cfcb", icon: "Ticket" }
  ],
  "itinerary": [
    {
      "day": "Day 1",
      "dateInfo": "4/21 (二) 抵達與安頓",
      "weatherHint": "氣溫約 15-20°C",
      "clothingHint": "春季薄外套＋舒適休閒服",
      "mapKeyword": "名古屋車站",
      "places": [
        {
          "id": generateId(),
          "type": "攻略", 
          "name": "🎫 機場出關 & μ-SKY 搭乘攻略", 
          "description": "• 出關動線：第 1 航廈入境 (2F) ➔ 往「交通廣場」 ➔ 左轉見名鐵剪票口與售票處。\n• 購票須知：搭乘 μ-SKY 需額外加購 ¥450「μ-ticket (特別車輛券)」。建議連同基本車票、回程 μ-ticket 一併買好。\n• 進站方式：刷 IC 卡或將基本乘車券投入閘門進站。μ-ticket 不用過閘門，上車後插在前方座位票夾供驗票。\n• 乘車月台：1 號月台", 
          "duration": "下機必讀", 
          "badges": ["實用指南"],
          "extraImages": [
            { "title": "名古屋機場交通", "url": "https://familyxonline.com/wp-content/uploads/2025/02/3-trams-from-airport-city-1.png" }
          ]
        },
        {
          "id": generateId(),
          "type": "交通", 
          "name": "搭乘 μ-SKY 前往市區", 
          "description": "搭乘 17:55 抵達的班機。辦理入境手續後，搭乘名鐵特急（μ-SKY）直達名鐵名古屋站。", 
          "duration": "約 40 分鐘", 
          "badges": ["交通"]
        },
        {
          "id": generateId(),
          "type": "活動", 
          "name": "🚶 車站穿越戰略：往新幹線口", 
          "description": "從名鐵名古屋站出站後，請一路跟著「新幹線」或「太閤通口」的指標走。\n穿過 JR 名古屋站的中央穿堂，一直走到穿堂盡頭（看到銀之鐘），走出去才是飯店所在的西側區域！", 
          "duration": "約 10-15 分", 
          "badges": ["步行", "迷宮破解"]
        },
        {
          "id": generateId(),
          "type": "酒店", 
          "name": "名鉄イン名古屋駅新幹線口", 
          "description": "辦理入住並放下行李。先讓自己安頓下來，準備迎接明天的早起行程。", 
          "duration": "Check-in", 
          "badges": [],
          "bookingInfo": "Agoda / 預訂編號：1712328365"
        },
        {
          "id": generateId(),
          "type": "食物", 
          "name": "車站周邊輕鬆晚餐", 
          "description": "在名古屋車站共構的地下街或商場找間喜歡的餐廳簡單吃個晚餐，早點休息。", 
          "duration": "約 1.5 小時", 
          "badges": ["必吃", "放鬆"]
        }
      ]
    },
    {
      "day": "Day 2",
      "dateInfo": "4/22 (三) 跟團D1：小京都與合掌村",
      "weatherHint": "山區氣溫偏涼約 8-15°C",
      "clothingHint": "防風外套＋保暖內搭",
      "mapKeyword": "白川鄉合掌村",
      "places": [
        { "id": generateId(), "type": "交通", "name": "JR名古屋站西口 Esca 地下街集合", "description": "08:15 集合，尋找接待處報到，08:30 準時搭乘專用巴士出發。", "duration": "準時抵達", "badges": ["注意時間"] },
        { "id": generateId(), "type": "景點", "name": "飛驒高山 (小京都)", "description": "在充滿江戶時代風情的老街自由散步，午餐自理。", "duration": "約 120 分鐘", "badges": ["必吃"] },
        { "id": generateId(), "type": "景點", "name": "白川鄉合掌村", "description": "漫步於世界遺產合掌造村落，感受童話般的寧靜氛圍。", "duration": "約 90 分鐘", "badges": ["必拍"] },
        { "id": generateId(), "type": "酒店", "name": "富山 Manten 飯店", "description": "晚上入住設有大型公共浴場的飯店，洗去一天的疲憊。晚餐需在飯店內或附近餐廳自理。", "duration": "過夜", "badges": ["放鬆"] }
      ]
    },
    {
      "day": "Day 3",
      "dateInfo": "4/23 (四) 跟團D2：大雪谷絕景",
      "weatherHint": "雪谷氣溫極低約 0-5°C",
      "clothingHint": "厚羽絨衣＋防滑雪靴＋毛帽墨鏡",
      "mapKeyword": "立山黑部 阿爾卑斯路線",
      "places": [
        { "id": generateId(), "type": "活動", "name": "立山黑部阿爾卑斯山脈路線", "description": "飯店早餐後出發。連續轉乘立山纜車、高原巴士抵達海拔 2450m 的室堂站。", "duration": "上午", "badges": ["交通體驗"] },
        { "id": generateId(), "type": "景點", "name": "大雪谷 (雪之大谷) 漫步", "description": "阿爾卑斯路線的最高潮！親自走在期間限定的巨大雪牆之間。", "duration": "約 1-2 小時", "badges": ["必拍", "絕景"] },
        { "id": generateId(), "type": "景點", "name": "黑部水壩", "description": "轉乘隧道電動巴士與纜車，從黑部湖步行參觀壯觀的黑部水壩。", "duration": "下午", "badges": ["景點"] },
        { "id": generateId(), "type": "交通", "name": "返回名古屋站", "description": "從扇澤站換乘專用巴士，預計 18:30 返抵名古屋站，結束豐富的兩天一夜行程。", "duration": "傍晚", "badges": [] },
        { "id": generateId(), "type": "酒店", "name": "名鉄イン名古屋駅新幹線口", "description": "結束兩天一夜的立山黑部行程，回到熟悉的飯店辦理入住並好好休息。", "duration": "Check-in", "badges": [], "bookingInfo": "Trip.com / 預訂編號：1688896815519009" }
      ]
    },
    {
      "day": "Day 4",
      "dateInfo": "4/24 (五) 吉卜力童話一日遊",
      "weatherHint": "氣溫約 15-22°C",
      "clothingHint": "好走的鞋子＋洋蔥式穿搭",
      "parkMapUrl": "https://jioujiou.tw/wp-content/uploads/2025/05/吉卜力公園地圖-1.jpg",
      "mapKeyword": "吉卜力公園",
      "places": [
        { "id": generateId(), "type": "交通", "name": "出發與步行", "duration": "08:00", "description": "從你下榻的「名鉄イン名古屋駅新幹線口」出發。由於飯店在車站西口，而地鐵東山線在偏東側的地下，請預留約 10 到 15 分鐘的步行時間穿越名古屋車站。", "badges": ["注意時間", "交通"] },
        { "id": generateId(), "type": "交通", "name": "【去程】地鐵 + Linimo", "duration": "08:33 - 09:28", "description": "車資共 670 円。\n• 08:33 搭乘 名古屋市營地鐵東山線（往藤丘方向）。\n• 09:01 抵達 藤丘站，跟著指標前往轉乘 Linimo。\n• 09:08 搭乘 Linimo（往八草方向）。\n• 09:21 抵達 愛·地球博紀念公園站。\n• 步行約 7 分鐘，於 09:28 抵達吉卜力公園。", "badges": ["交通", "乘換1回"] },
        { "id": generateId(), "type": "活動", "name": "入園與移動", "duration": "09:28 - 09:45", "description": "出站後，直接穿越戶外的電梯塔，沿著指標往最深處的「魔女之谷 (Valley of Witches)」入口前進。這段路程大約需要 10 到 15 分鐘。", "badges": ["步行"] },
        { "id": generateId(), "type": "活動", "name": "魔女之谷門口待命", "duration": "09:45 - 10:00", "description": "平日園區 10:00 開門，此時抵達剛好可以跟著排隊人潮，準備成為第一批進入魔女之谷的遊客。", "badges": ["重要", "準備入園"] },
        { "id": generateId(), "type": "購物", "name": "魔女之谷：領取兌換券", "duration": "10:00", "description": "一進入魔女之谷，立刻鎖定「售票車 (Ticket Truck)」領取《霍爾的移動城堡》購票兌換券！", "badges": ["必搶", "重要"] },
        { "id": generateId(), "type": "活動", "name": "移動至大倉庫", "duration": "10:30 - 10:45", "description": "帶著兌換券離開魔女之谷，悠閒散步前往「吉卜力大倉庫」門口排隊，準備迎接 11:00 的專屬入場時段。", "badges": ["注意時間"] },
        { "id": generateId(), "type": "景點", "name": "吉卜力大倉庫", "duration": "11:00 - 13:30", "description": "準時驗票入場。這兩個半小時完全專注於館內設施：直奔最熱門的「吉卜力動畫人物名場面展」拍無臉男車廂，參觀天空之城機器人兵、借物少女房間，並在「冒險飛行團」商店採買限定紀念品。", "badges": ["必拍", "必買"] },
        { "id": generateId(), "type": "食物", "name": "魔女之谷：飛天烤箱午餐", "duration": "13:30 - 14:30", "description": "離開大倉庫，重返魔女之谷。直奔「飛天烤箱」餐廳。此時剛好避開正午最尖峰人潮。點招牌肉餡派或魔女風鹹派。", "badges": ["必吃", "備案提醒"] },
        { "id": generateId(), "type": "景點", "name": "魔女之谷：進入霍爾城堡", "duration": "14:30 - 15:30", "description": "帶著早上的兌換券回到售票車，支付 ¥1,000 購買實體「當日入場券」。正式走進《霍爾的移動城堡》內部，親眼見證火惡魔卡西法的暖爐！", "badges": ["必拍", "絕景"] },
        { "id": generateId(), "type": "景點", "name": "魔法之里", "duration": "15:30 - 16:15", "description": "順路前往旁邊的「魔法之里」，看一眼巨大的乙事主溜滑梯與充滿日式風情的達達拉城。", "badges": ["景點"] },
        { "id": generateId(), "type": "景點", "name": "青春之丘", "duration": "16:15 - 17:00", "description": "慢慢往園區出口的方向移動，傍晚時分來到靠近入口處的「青春之丘」。", "badges": ["放鬆", "必拍"] },
        { "id": generateId(), "type": "交通", "name": "吉卜力公園 ➔ 榮商圈", "duration": "17:00 之後", "description": "從吉卜力公園搭乘 Linimo 回到地鐵「藤丘站」後，直接轉乘地鐵東山線就可以直達「榮 (Sakae)」站。", "badges": ["交通", "順路"] },
        { "id": generateId(), "type": "購物", "name": "綠洲 21 (Oasis 21) & 榮商圈", "description": "傍晚抵達市區，在榮商圈一帶吃晚餐。可以在宇宙船造型的玻璃屋頂上散步，欣賞名古屋電視塔夜景。", "duration": "晚上", "badges": ["必買", "放鬆"] },
        { "id": generateId(), "type": "交通", "name": "榮站 ➔ 名古屋站", "description": "抵達後，再次穿過名古屋車站的中央穿堂（櫻通口往太閣通口方向），步行約 10 分鐘回到位於西口的飯店休息。", "duration": "晚上", "badges": ["交通", "步行"] }
      ]
    },
    {
      "day": "Day 5",
      "dateInfo": "4/25 (六) 國寶犬山城與大須尋寶",
      "weatherHint": "氣溫約 16-21°C",
      "clothingHint": "春季薄外套＋舒適休閒服",
      "mapKeyword": "犬山城",
      "ticketGuide": {
        "title": "🎫 犬山城下町套票攻略",
        "description": "• 購買地：名鐵有站務員的窗口（彌富、赤池站除外）。\n• 名古屋站服務中心：平日 10:00-19:00 / 假日 09:00-18:00。\n• 內容物：名鐵來回車票、犬山城兌換券 (需至售票口換實體票)、有樂苑折價券、優惠券 (可蓋章用 3 次)。",
        "links": [
          { "text": "套票內容", "url": "https://www.meitetsu.co.jp/plan/campaign/detail/__icsFiles/afieldfile/2026/02/28/inuyamaticket.jpg", "type": "image" },
          { "text": "犬山優惠券", "url": "https://www.meitetsu.co.jp/plan/campaign/detail/__icsFiles/afieldfile/2026/02/19/2026A4tc.pdf", "type": "pdf" }
        ]
      },
      "places": [
        { "id": generateId(), "type": "交通", "name": "名鐵名古屋 → 犬山遊園", "description": "08:30 從飯店出發。08:46 於名鐵名古屋站 1 號月台搭車。出站後尋找指標，沿著木曾川散步約 15 分鐘。", "duration": "08:30 - 09:15", "badges": ["注意時間", "交通"] },
        { "id": generateId(), "type": "景點", "name": "三光稻荷神社 & 針綱神社", "description": "步行至天守閣途中的必經之地，人潮尚少。\n到「錢洗受付處」奉納 100 日圓，洗錢祈求財運。", "duration": "上午", "badges": ["必拍", "放鬆"], "goshuins": [{ "name": "三光稲荷神社", "price": "500円" }, { "name": "猿田彦神社", "price": "500円" }, { "name": "針綱神社", "price": "500円" }] },
        { "id": generateId(), "type": "景點", "name": "國寶犬山城天守閣", "description": "09:00 開門，此時抵達能完美避開 10:30 後的團體客！登上最頂層，享受木曾川微風並俯瞰城下町。", "duration": "09:30 - 11:00", "badges": ["絕景", "必拍"], "gojoins": [{ "name": "御城印", "price": "300円" }, { "name": "專屬御城印帳", "price": "2400円" }], "extraImages": [{ "title": "車站步行路線", "url": "https://inuyamajo.jp/wp-content/uploads/2020/03/route-from-station-en-1.png" }, { "title": "三條登山路線", "url": "https://inuyamajo.jp/wp-content/uploads/2020/03/three-routes-en-1.png" }] },
        { "id": generateId(), "type": "食物", "name": "犬山城下町散策：山田五平餅店", "description": "這棟建築本身是日本登錄有形文化財。品嚐現點現烤的傳統「五平餅」配上一杯熱茶。", "duration": "中午", "badges": ["必吃", "放鬆"] },
        { "id": generateId(), "type": "交通", "name": "犬山 → 上前津", "description": "路線：犬山站 →（名鐵犬山線直通運轉）→ 上小田井站（系統切換點）→（地下鐵鶴舞線）→ 上前津站。免下車即可直達！", "duration": "下午", "badges": ["交通", "順路"] },
        { "id": generateId(), "type": "攻略", "name": "🎫 大須商店街攻略", "description": "準備進入名古屋最熱鬧的商店街！您可以搭配這份官方地圖，輕鬆找到想去的街道與店家。", "duration": "參考", "badges": ["實用地圖"], "links": [{ "text": "大須官方地圖 (PDF)", "url": "https://osu.nagoya/images/osumap/01-02.pdf", "type": "pdf" }] },
        { "id": generateId(), "type": "購物", "name": "大須商店街尋寶散策", "description": "從上前津站 8 號出口出發，建議的精華散步路線：\n新天地通 ➔ 巨大招財貓地標 ➔ 三輪神社 ➔ 赤門通 ➔ 大須觀音通 ➔ 大須觀音寺", "duration": "下午", "badges": ["必買", "尋寶"] },
        { "id": generateId(), "type": "景點", "name": "三輪神社", "openHours": "09:00 - 17:00", "description": "祭祀大物主神，神話中的「因幡白兔」被視為神祇使者，境內有大量兔子元素。", "duration": "傍晚", "badges": ["放鬆", "必拍"], "goshuins": [{ "name": "三輪神社", "price": "400円" }] },
        { "id": generateId(), "type": "景點", "name": "大須觀音寺", "openHours": "09:00 - 17:00", "description": "正式名稱為北野山真福寺寶生院，與淺草觀音、津觀音並列為日本三大觀音。", "duration": "傍晚", "badges": ["景點"], "goshuins": [{ "name": "大須觀音寺", "price": "500円" }] },
        { "id": generateId(), "type": "交通", "name": "大須觀音站 ➔ 名古屋站", "description": "搭乘地下鐵鶴舞線至「伏見站」，轉乘東山線回到「名古屋站」。出站後步行返回飯店休息。", "duration": "晚上", "badges": ["交通", "順路"] }
      ]
    },
    {
      "day": "Day 6",
      "dateInfo": "4/26 (日) 準備返家",
      "weatherHint": "氣溫約 16-21°C",
      "clothingHint": "輕鬆好活動的機場穿搭",
      "mapKeyword": "中部國際機場",
      "places": [
        { "id": generateId(), "type": "交通", "name": "前往中部國際機場", "description": "因為要搭乘 10:40 的早班機，建議 07:30 左右出發搭乘名鐵前往機場。", "duration": "約 40 分鐘", "badges": ["注意時間", "交通"] },
        { "id": generateId(), "type": "購物", "name": "機場免稅店最後採買", "description": "抵達機場並完成報到手續後，把握時間在免稅店補齊伴手禮，帶著滿滿的回憶準備登機。", "duration": "約 1.5 小時", "badges": ["必買"] }
      ]
    }
  ]
};

const defaultPackingList = {
  carryOn: [
    { id: 'c1', text: '隨身背包 / 護照與影本', checked: false },
    { id: 'c2', text: '錢包 (日幣/信用卡)', checked: false },
    { id: 'c3', text: '手機、行動電源、充電線', checked: false },
    { id: 'c4', text: '實體網卡或開通 eSIM', checked: false },
  ],
  checked: [
    { id: 'b1', text: '換洗衣物 (洋蔥式穿搭)', checked: false },
    { id: 'b2', text: '盥洗用品 / 保養品', checked: false },
    { id: 'b3', text: '常備藥品 (腸胃/感冒/暈車)', checked: false },
    { id: 'b4', text: '折疊大容量環保袋 (裝戰利品)', checked: false },
  ],
  shopping: [
    { id: 's1', text: '休足時間 (每晚必備)', checked: false },
    { id: 's2', text: '合掌村限定伴手禮', checked: false },
  ]
};

const getIconForType = (type, className) => {
  const props = { className, size: 20 };
  switch (type) {
    case '食物': return <Utensils {...props} />;
    case '活動': return <Ticket {...props} />;
    case '購物': return <ShoppingBag {...props} />;
    case '景點': return <Camera {...props} />;
    case '酒店': return <Bed {...props} />;
    case '交通': return <Train {...props} />;
    case '攻略': return <MapIcon {...props} />;
    default: return <MapPin {...props} />;
  }
};

const getBadgeStyle = (badge) => {
  switch (badge) {
    case '必吃': return 'bg-orange-100 text-orange-700';
    case '必買': return 'bg-pink-100 text-pink-700';
    case '必拍': return 'bg-blue-100 text-blue-700';
    case '必搶': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    case '注意時間': return 'bg-red-100 text-red-700 border border-red-200';
    case '重要': return 'bg-red-500 text-white font-bold animate-pulse';
    case '備案提醒': return 'bg-gray-200 text-gray-700 italic';
    case '步行': return 'bg-blue-50 text-blue-600';
    case '迷宮破解': return 'bg-indigo-100 text-indigo-700';
    case '準備入園': return 'bg-purple-100 text-purple-700';
    case '放鬆': return 'bg-green-100 text-green-700';
    case '絕景': return 'bg-indigo-100 text-indigo-700';
    case '順路': return 'bg-teal-100 text-teal-700';
    case '乘換1回': return 'bg-cyan-100 text-cyan-700';
    case '實用地圖': return 'bg-orange-100 text-orange-800 border border-orange-200';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getWeatherIcon = (condition, props) => {
  switch(condition) {
    case 'Sunny': return <Sun {...props} className={`text-orange-400 ${props?.className || ''}`} />;
    case 'Cloudy': return <Cloud {...props} className={`text-gray-400 ${props?.className || ''}`} />;
    case 'Rain': return <CloudRain {...props} className={`text-blue-400 ${props?.className || ''}`} />;
    case 'Snow': return <Snowflake {...props} className={`text-cyan-400 ${props?.className || ''}`} />;
    case 'Wind': return <Wind {...props} className={`text-teal-400 ${props?.className || ''}`} />;
    default: return <Sun {...props} className={`text-orange-400 ${props?.className || ''}`} />;
  }
};

const getDocIconObj = (iconName) => {
  switch(iconName) {
    case 'Plane': return Plane;
    case 'Bed': return Bed;
    case 'MapPin': return MapPin;
    case 'Phone': return Phone;
    case 'Ticket': return Ticket;
    default: return FileText;
  }
};

const getDocColorClass = (iconName) => {
  switch(iconName) {
    case 'Plane': return 'bg-blue-50/80 text-blue-600 hover:bg-blue-100 border-blue-100/50';
    case 'Bed': return 'bg-teal-50/80 text-teal-600 hover:bg-teal-100 border-teal-100/50';
    case 'Ticket': return 'bg-pink-50/80 text-pink-600 hover:bg-pink-100 border-pink-100/50';
    case 'MapPin': return 'bg-orange-50/80 text-orange-600 hover:bg-orange-100 border-orange-100/50';
    case 'Phone': return 'bg-red-50/80 text-red-600 hover:bg-red-100 border-red-100/50';
    default: return 'bg-gray-50/80 text-gray-600 hover:bg-gray-100 border-gray-200/50';
  }
};

// --- MAIN VIEWS ---

const ItineraryView = ({ 
  user, weatherData, isLoadingWeather, setPreviewImage, itineraryData, setItineraryData, updateFirestoreItinerary
}) => {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const currentDay = itineraryData[selectedDayIdx];
  
  const viewRef = useRef(null);
  const dayNavRef = useRef(null);

  const [activeMenuIdx, setActiveMenuIdx] = useState(null); 
  const [editModal, setEditModal] = useState({ isOpen: false, placeIdx: null, insertIdx: null, data: null });
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null); 

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.scrollTop = 0;
    }
    setActiveMenuIdx(null); 
    setConfirmDeleteIdx(null);

    if (dayNavRef.current) {
      const activeBtn = dayNavRef.current.querySelector('[data-active="true"]');
      if (activeBtn) {
        const scrollLeft = activeBtn.offsetLeft - dayNavRef.current.offsetWidth / 2 + activeBtn.offsetWidth / 2;
        dayNavRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [selectedDayIdx]);

  const movePlace = (idx, direction) => {
    setConfirmDeleteIdx(null);
    if (direction === -1 && idx === 0) return;
    if (direction === 1 && idx === currentDay.places.length - 1) return;

    const newData = [...itineraryData];
    const dayData = { ...newData[selectedDayIdx] };
    const newPlaces = [...dayData.places];

    const temp = newPlaces[idx];
    newPlaces[idx] = newPlaces[idx + direction];
    newPlaces[idx + direction] = temp;

    dayData.places = newPlaces;
    newData[selectedDayIdx] = dayData;

    setItineraryData(newData);
    updateFirestoreItinerary(newData);
  };

  const deletePlace = (idx) => {
    const newData = [...itineraryData];
    const newPlaces = [...newData[selectedDayIdx].places];
    newPlaces.splice(idx, 1);
    newData[selectedDayIdx].places = newPlaces;
    setItineraryData(newData);
    updateFirestoreItinerary(newData);
    setConfirmDeleteIdx(null);
  };

  const duplicatePlace = (idx) => {
    setConfirmDeleteIdx(null);
    const newData = [...itineraryData];
    const newPlaces = [...newData[selectedDayIdx].places];
    const clonedPlace = JSON.parse(JSON.stringify(newPlaces[idx])); 
    clonedPlace.name = clonedPlace.name + ' (複製)';
    clonedPlace.id = generateId(); 
    newPlaces.splice(idx + 1, 0, clonedPlace);
    newData[selectedDayIdx].places = newPlaces;
    setItineraryData(newData);
    updateFirestoreItinerary(newData);
  };

  const openEditModal = (placeIdx = null, placeData = null, insertIdx = null) => {
    setConfirmDeleteIdx(null);
    const defaultData = { id: '', type: '景點', name: '', description: '', duration: '約 1 小時', badges: '', openHours: '', bookingInfo: '' };
    const formData = placeData ? { ...defaultData, ...placeData, badges: placeData.badges ? placeData.badges.join('，') : '' } : defaultData;
    setEditModal({ isOpen: true, placeIdx, insertIdx, data: formData });
  };

  const saveEditModal = () => {
    if (!editModal.data.name.trim()) return;

    const newData = [...itineraryData];
    const dayData = { ...newData[selectedDayIdx] };
    const newPlaces = [...dayData.places];

    const processedBadges = editModal.data.badges 
      ? editModal.data.badges.split(/[,，]/).map(b => b.trim()).filter(b => b) 
      : [];

    const processedData = { 
      ...editModal.data, 
      id: editModal.data.id || generateId(),
      badges: processedBadges 
    };
    
    if (!processedData.openHours) delete processedData.openHours;
    if (!processedData.bookingInfo) delete processedData.bookingInfo;

    if (editModal.placeIdx !== null) {
      newPlaces[editModal.placeIdx] = processedData;
    } else {
      if (editModal.insertIdx !== null) {
        newPlaces.splice(editModal.insertIdx, 0, processedData);
      } else {
        newPlaces.push(processedData);
      }
    }

    dayData.places = newPlaces;
    newData[selectedDayIdx] = dayData;

    setItineraryData(newData);
    updateFirestoreItinerary(newData);
    setEditModal({ isOpen: false, placeIdx: null, insertIdx: null, data: null });
  };

  const mapQueryName = currentDay.mapKeyword || currentDay.places.find(p => ['景點', '活動', '購物'].includes(p.type))?.name || currentDay.places[0]?.name || "名古屋車站";
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQueryName)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

  const InlineAddButton = ({ insertIdx }) => (
    <div className="relative flex items-center z-10 group cursor-pointer -my-2" onClick={() => openEditModal(null, null, insertIdx)}>
      <div className="w-12 flex justify-center flex-shrink-0">
        <div className="bg-[#FAF9F6] py-1.5 z-10">
          <div className="w-6 h-6 rounded-full bg-white border-2 border-dashed border-[#A39D78]/60 text-[#A39D78] flex items-center justify-center group-hover:border-[#773690] group-hover:text-[#773690] group-hover:bg-purple-50 group-hover:scale-110 transition-all shadow-sm">
            <Plus size={14} strokeWidth={3} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto hide-scrollbar relative pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in fade-in duration-300" ref={viewRef}>
      
      <div className="sticky top-0 bg-[#FAF9F6]/95 backdrop-blur-md z-[40] py-3 border-b border-[#A39D78]/20 shadow-sm">
        <div ref={dayNavRef} className="flex overflow-x-auto hide-scrollbar px-4 gap-3 scroll-smooth">
          {itineraryData.map((day, idx) => (
            <button
              key={idx}
              data-active={selectedDayIdx === idx}
              onClick={() => setSelectedDayIdx(idx)}
              className={`whitespace-nowrap px-5 py-2 rounded-full font-medium transition-all ${
                selectedDayIdx === idx
                  ? 'bg-[#773690] text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {day.day}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 relative z-10">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#A39D78]/10 mb-6 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <h2 className="text-xl font-bold text-[#773690] flex items-center gap-2">
              <Calendar size={22} />
              {currentDay.dateInfo}
            </h2>
          </div>
          
          <div className="flex flex-col gap-2 text-sm text-gray-600">
            {isLoadingWeather ? (
              <div className="flex items-center gap-2 bg-[#FAF9F6] p-2 rounded-xl animate-pulse text-[#A39D78]">
                <Loader2 size={18} className="animate-spin" />
                <span>天氣觀測站連線中...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 bg-[#FAF9F6] p-2 rounded-xl">
                  {weatherData ? getWeatherIcon(weatherData[selectedDayIdx]?.condition, {size: 18, className: "text-[#A39D78]"}) : <Sun size={18} className="text-[#A39D78]" />}
                  <span>{weatherData ? `${weatherData[selectedDayIdx]?.desc}，氣溫約 ${weatherData[selectedDayIdx]?.temp}` : currentDay.weatherHint}</span>
                </div>
                <div className="flex items-center gap-2 bg-[#FAF9F6] p-2 rounded-xl">
                  <Umbrella size={18} className="text-[#A39D78]" />
                  <span>{weatherData ? weatherData[selectedDayIdx]?.clothingHint : currentDay.clothingHint}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 mb-6 overflow-hidden transition-all hover:shadow-md">
          <h3 className="text-sm font-bold text-[#773690] mb-2 px-2 flex items-center gap-1.5 pt-1">
            <MapIcon size={16} />
            當日路線與地圖
          </h3>
          <div className="w-full h-[180px] rounded-xl overflow-hidden relative bg-gray-100">
            <iframe 
              src={mapEmbedUrl}
              width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              title={`Google Map for ${currentDay.day}`}
            ></iframe>
          </div>
        </div>

        {currentDay.parkMapUrl && (
          <div 
            className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden transition-all hover:shadow-md cursor-pointer group" 
            onClick={() => setPreviewImage(currentDay.parkMapUrl)}
          >
            <h3 className="text-sm font-bold text-[#773690] mb-2 px-4 flex items-center justify-between pt-3">
              <span className="flex items-center gap-1.5"><MapIcon size={16} /> 園區導覽地圖</span>
              <ZoomIn size={16} className="text-gray-400 group-hover:text-[#773690]" />
            </h3>
            <div className="w-full relative bg-gray-100 p-1 rounded-b-2xl">
              <img src={currentDay.parkMapUrl} alt="園區導覽地圖" className="w-full h-auto block rounded-xl transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-b-2xl">
                <span className="bg-white/95 text-[#773690] px-4 py-1.5 rounded-full text-xs font-bold shadow-md backdrop-blur-sm">點擊放大檢視</span>
              </div>
            </div>
          </div>
        )}

        {currentDay.ticketGuide && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl p-5 shadow-sm border border-orange-100 mb-6 transition-all hover:shadow-md">
            <h3 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-1.5">
              <Ticket size={18} />
              {currentDay.ticketGuide.title}
            </h3>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mb-4">
              {currentDay.ticketGuide.description}
            </p>
            <div className="flex gap-2">
              {currentDay.ticketGuide.links.map((link, idx) => (
                link.type === 'image' ? (
                  <button 
                    key={idx}
                    onClick={() => setPreviewImage(link.url)}
                    className="flex-1 bg-white border border-orange-200 text-orange-700 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-orange-50 transition-colors"
                  >
                    <ImageIcon size={16} /> {link.text}
                  </button>
                ) : (
                  <a 
                    key={idx}
                    href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-orange-600 transition-colors"
                  >
                    <FileText size={16} /> {link.text}
                  </a>
                )
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#773690]/20 before:to-transparent">
          
          <InlineAddButton insertIdx={0} />

          {currentDay.places.map((place, idx) => {
            const isStrategy = place.type === '攻略';

            return (
              <React.Fragment key={place.id || idx}>
                <div className={`relative flex items-start gap-4 group py-2 ${activeMenuIdx === idx ? 'z-[60]' : 'z-0'}`}>
                  <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-white border-2 ${isStrategy ? 'border-orange-400 text-orange-500' : 'border-[#773690] text-[#773690]'} shadow-sm flex items-center justify-center transition-colors`}>
                    {getIconForType(place.type, "")}
                  </div>

                  <div className={`flex-1 rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md bg-white ${isStrategy ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-100' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-start mb-2 relative">
                      <h3 className={`font-bold text-lg leading-tight ${isStrategy ? 'text-orange-800 flex items-center gap-1.5' : 'text-gray-800'}`}>
                        {isStrategy && <MapIcon size={18} />}
                        {place.name}
                      </h3>

                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveMenuIdx(activeMenuIdx === idx ? null : idx); setConfirmDeleteIdx(null); }}
                          className="p-2 -mr-2 -mt-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <MoreVertical size={20} />
                        </button>

                        {activeMenuIdx === idx && (
                          <>
                            <div className="fixed inset-0 z-[110]" onClick={() => setActiveMenuIdx(null)}></div>
                            <div className="absolute right-0 top-8 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-[120] animate-in fade-in zoom-in-95 duration-200">
                              <button onClick={() => { openEditModal(idx, place); setActiveMenuIdx(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Pencil size={14}/> 編輯卡片</button>
                              <button onClick={() => { duplicatePlace(idx); setActiveMenuIdx(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Copy size={14}/> 複製行程</button>
                              <div className="h-px bg-gray-100 my-1"></div>
                              <button onClick={() => { movePlace(idx, -1); setActiveMenuIdx(null); }} disabled={idx === 0} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-30 flex items-center gap-2"><ChevronUp size={14}/> 往上移</button>
                              <button onClick={() => { movePlace(idx, 1); setActiveMenuIdx(null); }} disabled={idx === currentDay.places.length - 1} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-30 flex items-center gap-2"><ChevronDown size={14}/> 往下移</button>
                              <div className="h-px bg-gray-100 my-1"></div>
                              {confirmDeleteIdx === idx ? (
                                 <button onClick={() => { deletePlace(idx); setActiveMenuIdx(null); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 font-bold hover:bg-red-50 flex items-center gap-2 bg-red-50/50"><Trash2 size={14}/> 確定刪除?</button>
                              ) : (
                                 <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteIdx(idx); }} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"><Trash2 size={14}/> 刪除卡片</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {!isStrategy && place.openHours && (
                      <div className="inline-flex items-center gap-1.5 bg-blue-50/80 text-blue-700 px-3 py-1.5 rounded-xl text-[13px] font-bold border border-blue-100/50 mb-3 shadow-sm">
                        <Clock size={14} className="text-blue-600" />
                        開放時間 {place.openHours}
                      </div>
                    )}

                    {!isStrategy && place.bookingInfo && (
                      <div className="inline-flex items-center gap-1.5 bg-teal-50/80 text-teal-700 px-3 py-1.5 rounded-xl text-[13px] font-bold border border-teal-100/50 mb-3 shadow-sm">
                        <CheckCheck size={14} className="text-teal-600" />
                        {place.bookingInfo}
                      </div>
                    )}
                    
                    {place.badges && place.badges.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {place.badges.map((badge, bIdx) => (
                          <span key={bIdx} className={`text-xs px-2.5 py-1 rounded-full font-medium ${getBadgeStyle(badge)}`}>
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-gray-600 text-sm mb-4 leading-relaxed whitespace-pre-wrap">{place.description}</p>
                    
                    {!isStrategy && place.goshuins && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {place.goshuins.map((gs, gIdx) => (
                          <div key={gIdx} className="inline-flex items-center gap-1.5 bg-[#773690]/10 text-[#773690] px-2.5 py-1.5 rounded-xl text-xs font-bold border border-[#773690]/20 shadow-sm">
                            <span className="text-sm">⛩️</span>
                            <span>御朱印 ({gs.name})</span>
                            <span className="ml-0.5 bg-white px-1.5 py-0.5 rounded-md text-[10px] text-[#773690] shadow-sm">{gs.price}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isStrategy && place.gojoins && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {place.gojoins.map((gj, gIdx) => (
                          <div key={gIdx} className="inline-flex items-center gap-1.5 bg-slate-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-600 shadow-sm">
                            <span className="text-sm">🏯</span>
                            <span>{gj.name}</span>
                            <span className="ml-0.5 bg-slate-800 px-1.5 py-0.5 rounded-md text-[10px] text-slate-200">{gj.price}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {place.extraImages && (
                      <div className={`flex gap-3 mb-4 overflow-x-auto hide-scrollbar pb-2 ${isStrategy ? '' : 'mt-2'}`}>
                        {place.extraImages.map((img, iIdx) => (
                          <div 
                            key={iIdx} 
                            onClick={() => setPreviewImage(img.url)}
                            className={`relative flex-shrink-0 w-28 h-20 rounded-xl overflow-hidden shadow-sm cursor-pointer group border ${isStrategy ? 'border-orange-200' : 'border-gray-200'}`}
                          >
                            <img src={img.url} alt={img.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <ZoomIn size={16} className="text-white mb-1" />
                              <span className="text-[10px] text-white font-bold">{img.title}</span>
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
                              <p className="text-[10px] text-white font-bold truncate group-hover:opacity-0 transition-opacity">{img.title}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isStrategy && place.links && (
                      <div className="flex gap-2 mb-2">
                        {place.links.map((link, lIdx) => (
                          link.type === 'image' ? (
                            <button 
                              key={lIdx}
                              onClick={() => setPreviewImage(link.url)}
                              className="flex-1 bg-white border border-orange-200 text-orange-700 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-orange-50 transition-colors"
                            >
                              <ImageIcon size={16} /> {link.text}
                            </button>
                          ) : (
                            <a 
                              key={lIdx}
                              href={link.url} target="_blank" rel="noopener noreferrer"
                              className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-orange-600 transition-colors"
                            >
                              <FileText size={16} /> {link.text}
                            </a>
                          )
                        ))}
                      </div>
                    )}

                    {!isStrategy && (
                      <div className="flex items-center gap-2 text-sm text-[#A39D78] font-medium mb-4">
                        <Clock size={16} />
                        <span>{place.duration}</span>
                      </div>
                    )}

                    {!isStrategy && (
                      <div className="flex pt-2 border-t border-gray-50">
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 bg-[#FAF9F6] hover:bg-[#A39D78]/10 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition-colors"
                        >
                          <Navigation size={16} className="text-[#A39D78]" />
                          Google 地圖導航
                        </a>
                      </div>
                    )}

                  </div>
                </div>

                <InlineAddButton insertIdx={idx + 1} />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {editModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#773690] text-white p-4 flex justify-between items-center flex-shrink-0">
              <h3 className="font-bold">{editModal.placeIdx !== null ? '編輯行程卡片' : '新增行程卡片'}</h3>
              <button onClick={() => setEditModal({ isOpen: false, placeIdx: null, insertIdx: null, data: null })} className="bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto hide-scrollbar flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">卡片類型</label>
                <select 
                  value={editModal.data.type}
                  onChange={e => setEditModal({...editModal, data: {...editModal.data, type: e.target.value}})}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#773690] bg-gray-50 font-medium"
                >
                  {['交通', '景點', '食物', '購物', '酒店', '活動', '攻略'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">標題 (必填)</label>
                <input 
                  type="text" value={editModal.data.name}
                  onChange={e => setEditModal({...editModal, data: {...editModal.data, name: e.target.value}})}
                  placeholder="例如：抵達中部國際機場"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#773690] bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">詳細說明</label>
                <textarea 
                  value={editModal.data.description}
                  onChange={e => setEditModal({...editModal, data: {...editModal.data, description: e.target.value}})}
                  placeholder="行程的詳細資訊、轉車攻略等..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#773690] bg-gray-50 h-24 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">花費時間</label>
                  <input 
                    type="text" value={editModal.data.duration || ''}
                    onChange={e => setEditModal({...editModal, data: {...editModal.data, duration: e.target.value}})}
                    placeholder="例如：約 1.5 小時"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#773690] bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">特色標籤 (逗號分隔)</label>
                  <input 
                    type="text" value={editModal.data.badges || ''}
                    onChange={e => setEditModal({...editModal, data: {...editModal.data, badges: e.target.value}})}
                    placeholder="例如：必吃，注意時間"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#773690] bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-600 mb-1.5">開放時間 (選填)</label>
                  <input 
                    type="text" value={editModal.data.openHours || ''}
                    onChange={e => setEditModal({...editModal, data: {...editModal.data, openHours: e.target.value}})}
                    placeholder="例：09:00 - 17:00"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-teal-600 mb-1.5">訂房/備註 (選填)</label>
                  <input 
                    type="text" value={editModal.data.bookingInfo || ''}
                    onChange={e => setEditModal({...editModal, data: {...editModal.data, bookingInfo: e.target.value}})}
                    placeholder="例：Agoda 1234"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-500 bg-gray-50"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-gray-50 rounded-b-3xl">
              <button 
                onClick={saveEditModal}
                disabled={!editModal.data.name.trim()}
                className="w-full bg-[#773690] text-white py-3.5 rounded-xl text-sm font-bold shadow-md hover:bg-[#602b75] transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                <Save size={18} /> 儲存行程
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const GuideView = ({ 
  user, packingList, setPackingList, isListLoaded, updateFirestore
}) => {
  const [expandedSection, setExpandedSection] = useState(null); 
  const [newCarryOnItem, setNewCarryOnItem] = useState('');
  const [newCheckedItem, setNewCheckedItem] = useState('');
  const [newShoppingItem, setNewShoppingItem] = useState('');

  const [deletedItemInfo, setDeletedItemInfo] = useState(null); 
  const [toastMsg, setToastMsg] = useState(null);

  const [translateInput, setTranslateInput] = useState('');
  // 將翻譯結果改為陣列，以支援多重關鍵字顯示
  const [translateResults, setTranslateResults] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  const [emergencyModal, setEmergencyModal] = useState({ isOpen: false, number: '', name: '' });

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleCheck = (category, id) => {
    const newList = {
      ...packingList,
      [category]: packingList[category].map(item => 
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    };
    setPackingList(newList); 
    updateFirestore(newList); 
  };

  const handleAddItem = (e, category, text, setTextFn) => {
    e.preventDefault();
    if (!text.trim()) return;
    const newItemObj = { id: Date.now().toString(), text: text.trim(), checked: false };
    const newList = {
      ...packingList,
      [category]: [...packingList[category], newItemObj]
    };
    setPackingList(newList);
    updateFirestore(newList);
    setTextFn('');
  };

  const handleDeleteItem = (e, category, id) => {
    e.preventDefault();
    e.stopPropagation();

    const itemToDelete = packingList[category].find(i => i.id === id);
    const itemIndex = packingList[category].findIndex(i => i.id === id);

    const newList = {
      ...packingList,
      [category]: packingList[category].filter(item => item.id !== id)
    };
    setPackingList(newList);
    updateFirestore(newList);

    if (deletedItemInfo?.timeoutId) clearTimeout(deletedItemInfo.timeoutId);

    const timeoutId = setTimeout(() => {
      setToastMsg(null);
      setDeletedItemInfo(null);
    }, 5000);

    setDeletedItemInfo({ category, item: itemToDelete, index: itemIndex, timeoutId });
    setToastMsg(`已刪除「${itemToDelete.text}」`);
  };

  const handleUndo = () => {
    if (!deletedItemInfo) return;
    const { category, item, index, timeoutId } = deletedItemInfo;
    clearTimeout(timeoutId);

    const newCategoryList = [...packingList[category]];
    newCategoryList.splice(index, 0, item);

    const newList = { ...packingList, [category]: newCategoryList };
    setPackingList(newList);
    updateFirestore(newList);

    setToastMsg(null);
    setDeletedItemInfo(null);
  };

  // --- 關鍵字辭典搜尋 ---
  const handleSearchTranslate = (e) => {
    e.preventDefault();
    if(!translateInput.trim()) return;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }

    const query = translateInput.toLowerCase();
    const matchedCards = [];

    TRANSLATION_DICT.forEach(item => {
      const isMatch = item.keywords.some(kw => query.includes(kw));
      if (isMatch) {
        matchedCards.push(item);
      }
    });

    if (matchedCards.length > 0) {
      setTranslateResults(matchedCards);
    } else {
      // 找不到關鍵字，顯示預設委婉回應
      setTranslateResults([DEFAULT_TRANSLATION]);
    }
  };

  // --- 使用 Web Speech API 朗讀日文 ---
  const handlePlayTTS = (textToPlay) => {
    if (!textToPlay) return;

    if (!('speechSynthesis' in window)) {
      setToastMsg('您的設備或瀏覽器不支援語音功能。');
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToPlay);
    utterance.lang = 'ja-JP';
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleModalCall = (number, name) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = number;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setToastMsg(`已複製 ${name} 電話，您可直接貼上。`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error("Emergency copy failed", err);
    }
    setEmergencyModal({ isOpen: false, number: '', name: '' });
  };

  const AccordionHeader = ({ id, title, icon: Icon }) => (
    <button 
      onClick={() => setExpandedSection(expandedSection === id ? null : id)}
      className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors rounded-2xl"
    >
      <div className="flex items-center gap-3 text-gray-800 font-bold">
        <div className="bg-[#FAF9F6] p-2 rounded-xl text-[#773690]">
          <Icon size={20} />
        </div>
        {title}
      </div>
      {expandedSection === id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
    </button>
  );

  const getProgress = (category) => {
    const total = packingList[category].length;
    const checked = packingList[category].filter(i => i.checked).length;
    return { total, checked, percent: total === 0 ? 0 : (checked / total) * 100 };
  };
  const carryOnStats = getProgress('carryOn');
  const checkedStats = getProgress('checked');
  const shoppingStats = getProgress('shopping');

  return (
    <div className="h-full overflow-y-auto hide-scrollbar px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4 animate-in fade-in duration-300 relative">
      
      <div className="flex overflow-x-auto hide-scrollbar gap-3 pb-2 -mx-4 px-4 mb-2">
        <button 
          onClick={(e) => {
            e.preventDefault();
            setEmergencyModal({ isOpen: true, number: '+81 3 3280 7811', name: '代表處' });
          }} 
          className="cursor-pointer flex-shrink-0 flex flex-col items-center justify-center w-[76px] py-3.5 rounded-2xl transition-all shadow-sm border bg-red-50/80 text-red-600 hover:bg-red-100 border-red-100/50"
        >
          <Phone size={24} className="mb-2" />
          <span className="text-[10px] font-bold text-center leading-tight px-1">急難救助</span>
        </button>
        
        {mockData.documents.map((doc, idx) => {
          const IconComp = getDocIconObj(doc.icon);
          const colorClass = getDocColorClass(doc.icon);
          return (
            <a 
              key={idx} 
              href={doc.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`cursor-pointer flex-shrink-0 flex flex-col items-center justify-center w-[76px] py-3.5 rounded-2xl transition-all shadow-sm border ${colorClass}`}
            >
              <IconComp size={24} className="mb-2" />
              <span className="text-[10px] font-bold text-center leading-tight px-1 break-words">{doc.title}</span>
            </a>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <AccordionHeader id="translator" title="隨身翻譯蒟蒻" icon={MessageCircle} />
        {expandedSection === 'translator' && (
          <div className="p-5 pt-0 border-t border-gray-50">
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
              <Info size={12} /> 輸入你想說的話 (如：廁所、拍照、結帳)
            </p>
            <form onSubmit={handleSearchTranslate} className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={translateInput} 
                  onChange={(e) => setTranslateInput(e.target.value)} 
                  placeholder="請輸入關鍵字..." 
                  className="w-full px-3 py-2.5 pr-8 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#773690] bg-gray-50/50" 
                />
                {translateInput && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setTranslateInput('');
                      setTranslateResults(null);
                    }} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#773690] p-1"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button 
                type="submit" 
                disabled={!translateInput.trim()} 
                className="bg-[#773690] text-white px-4 rounded-xl hover:bg-[#602b75] transition-colors disabled:opacity-50 font-bold text-sm flex items-center justify-center min-w-[70px]"
              >
                查詢
              </button>
            </form>
            
            {translateResults && (
              <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {translateResults.map((data, idx) => (
                  <div key={idx} className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#A39D78]/20 relative overflow-hidden">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1">
                        <h5 className="text-[10px] font-bold text-[#A39D78] mb-1">【日文】</h5>
                        <p className="text-lg text-gray-800 font-bold leading-relaxed">{data.jp}</p>
                      </div>
                      <button 
                        onClick={() => {
                          // 先建立空的互動來解鎖語音權限（針對 iOS Safari）
                          if ('speechSynthesis' in window) {
                            const unlockUtterance = new SpeechSynthesisUtterance('');
                            unlockUtterance.volume = 0;
                            window.speechSynthesis.speak(unlockUtterance);
                          }
                          handlePlayTTS(data.jp);
                        }}
                        className={`p-3 rounded-full shadow-sm transition-colors flex-shrink-0 flex items-center justify-center ${isPlayingAudio ? 'bg-[#773690] text-white animate-pulse' : 'bg-white text-[#773690] hover:bg-gray-50 border border-purple-100'}`}
                      >
                        <Volume2 size={20} />
                      </button>
                    </div>
                    
                    <div className="mb-4">
                      <h5 className="text-[10px] font-bold text-[#A39D78] mb-0.5">【羅馬拼音】</h5>
                      <p className="text-xs text-gray-500">{data.romaji}</p>
                    </div>

                    <div className="mb-4">
                      <h5 className="text-[10px] font-bold text-[#A39D78] mb-0.5">【中文對照】</h5>
                      <p className="text-xs text-gray-700 font-medium">{data.zh}</p>
                    </div>

                    {data.tip && (
                      <div className="bg-white p-3 rounded-xl border border-gray-100">
                        <h5 className="text-[10px] font-bold text-[#773690] mb-1 flex items-center gap-1">
                           <Info size={14} /> 小提醒
                        </h5>
                        <p className="text-xs text-gray-600 leading-snug">{data.tip}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <AccordionHeader id="packing" title="行李打包與購物清單" icon={ShoppingBag} />
        {expandedSection === 'packing' && (
          <div className="p-5 pt-0 border-t border-gray-50 space-y-6">
            {!isListLoaded ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-[#A39D78]" /></div>
            ) : (
              <>
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-[#A39D78] flex items-center gap-2">隨身/手提行李 (機艙)</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-bold">{carryOnStats.checked}/{carryOnStats.total}</span>
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#A39D78] transition-all duration-500" style={{ width: `${carryOnStats.percent}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-3">
                    {packingList.carryOn.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors group">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input type="checkbox" className="hidden" checked={item.checked} onChange={() => toggleCheck('carryOn', item.id)} />
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${item.checked ? 'bg-[#773690] border-[#773690]' : 'border-gray-300 group-hover:border-[#773690]'}`}>
                            {item.checked && <Check size={14} className="text-white" />}
                          </div>
                          <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.text}</span>
                        </label>
                        <button 
                          onClick={(e) => handleDeleteItem(e, 'carryOn', item.id)} 
                          className="p-1.5 rounded-lg transition-colors text-gray-300 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => handleAddItem(e, 'carryOn', newCarryOnItem, setNewCarryOnItem)} className="flex gap-2">
                    <input type="text" value={newCarryOnItem} onChange={(e) => setNewCarryOnItem(e.target.value)} placeholder="新增隨身物品..." className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#773690] bg-gray-50/50" />
                    <button type="submit" className="bg-[#FAF9F6] text-[#A39D78] border border-gray-200 p-2 rounded-xl hover:bg-[#A39D78] hover:text-white transition-colors"><Plus size={20} /></button>
                  </form>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-[#A39D78] flex items-center gap-2">托運行李</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-bold">{checkedStats.checked}/{checkedStats.total}</span>
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#A39D78] transition-all duration-500" style={{ width: `${checkedStats.percent}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-3">
                    {packingList.checked.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors group">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input type="checkbox" className="hidden" checked={item.checked} onChange={() => toggleCheck('checked', item.id)} />
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${item.checked ? 'bg-[#773690] border-[#773690]' : 'border-gray-300 group-hover:border-[#773690]'}`}>
                            {item.checked && <Check size={14} className="text-white" />}
                          </div>
                          <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.text}</span>
                        </label>
                        <button 
                          onClick={(e) => handleDeleteItem(e, 'checked', item.id)} 
                          className="p-1.5 rounded-lg transition-colors text-gray-300 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => handleAddItem(e, 'checked', newCheckedItem, setNewCheckedItem)} className="flex gap-2">
                    <input type="text" value={newCheckedItem} onChange={(e) => setNewCheckedItem(e.target.value)} placeholder="新增托運物品..." className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#773690] bg-gray-50/50" />
                    <button type="submit" className="bg-[#FAF9F6] text-[#A39D78] border border-gray-200 p-2 rounded-xl hover:bg-[#A39D78] hover:text-white transition-colors"><Plus size={20} /></button>
                  </form>
                </div>

                <div className="bg-[#FAF9F6] p-4 rounded-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-[#773690] flex items-center gap-2">日本必買許願池</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#773690]/60 font-bold">{shoppingStats.checked}/{shoppingStats.total}</span>
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#773690] transition-all duration-500" style={{ width: `${shoppingStats.percent}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-3">
                    {packingList.shopping.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white transition-colors group">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input type="checkbox" className="hidden" checked={item.checked} onChange={() => toggleCheck('shopping', item.id)} />
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${item.checked ? 'bg-[#773690] border-[#773690]' : 'border-gray-300 bg-white group-hover:border-[#773690]'}`}>
                            {item.checked && <Check size={14} className="text-white" />}
                          </div>
                          <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.text}</span>
                        </label>
                        <button 
                          onClick={(e) => handleDeleteItem(e, 'shopping', item.id)} 
                          className="p-1.5 rounded-lg transition-colors text-gray-300 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => handleAddItem(e, 'shopping', newShoppingItem, setNewShoppingItem)} className="flex gap-2">
                    <input type="text" value={newShoppingItem} onChange={(e) => setNewShoppingItem(e.target.value)} placeholder="新增想買的物品..." className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#773690] bg-white" />
                    <button type="submit" className="bg-[#773690] text-white p-2 rounded-xl hover:bg-[#602b75] transition-colors"><Plus size={20} /></button>
                  </form>
                </div>
              </>
            )}

          </div>
        )}
      </div>

      {toastMsg && (
        <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-4 z-[110] animate-in slide-in-from-bottom-5 pointer-events-none">
          <span className="text-sm whitespace-nowrap">{toastMsg}</span>
          {deletedItemInfo && (
            <button 
              onClick={handleUndo} 
              className="text-[#A39D78] font-bold text-sm hover:text-yellow-400 transition-colors bg-white/10 px-3 py-1 rounded-full whitespace-nowrap pointer-events-auto"
            >
              復原
            </button>
          )}
        </div>
      )}
      
      {emergencyModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setEmergencyModal({ ...emergencyModal, isOpen: false })}></div>
          <div className="relative z-10 w-full max-w-md mx-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-2 animate-in slide-in-from-bottom-4 duration-300">
            <button 
              onClick={(e) => {
                e.preventDefault();
                handleModalCall(emergencyModal.number, emergencyModal.name);
              }}
              className="w-full bg-[#007AFF] text-white py-4 rounded-[1.25rem] text-[19px] font-medium text-center shadow-sm block active:bg-[#005bb5] transition-colors"
            >
              複製 {emergencyModal.number}
            </button>
            <button 
              onClick={() => setEmergencyModal({ ...emergencyModal, isOpen: false })}
              className="w-full bg-[#F2F2F7] text-[#007AFF] py-4 rounded-[1.25rem] text-[19px] font-bold text-center shadow-sm active:bg-[#e5e5ea] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

const WeatherView = ({ weatherData, isLoadingWeather }) => {
  const fallbackWeatherForecast = [
    { day: '4/21', weekday: '二', temp: '15° / 20°', condition: 'Rain', desc: '多雲時雨', clothingHint: '建議帶雨傘及防風外套' },
    { day: '4/22', weekday: '三', temp: '8° / 15°', condition: 'Rain', desc: '山區陣雨', clothingHint: '山區濕冷，需防水保暖外套' },
    { day: '4/23', weekday: '四', temp: '0° / 5°', condition: 'Wind', desc: '雪谷寒冷', clothingHint: '嚴寒！厚羽絨衣、手套與毛帽' },
    { day: '4/24', weekday: '五', temp: '15° / 22°', condition: 'Sunny', desc: '晴朗舒適', clothingHint: '洋蔥式穿搭，早晚微涼' },
    { day: '4/25', weekday: '六', temp: '16° / 21°', condition: 'Sunny', desc: '晴時多雲', clothingHint: '薄長袖加上輕便外套' },
    { day: '4/26', weekday: '日', temp: '16° / 21°', condition: 'Sunny', desc: '晴朗', clothingHint: '舒適休閒服與好走的鞋' },
  ];
  
  const displayData = weatherData || fallbackWeatherForecast;

  return (
    <div className="h-full overflow-y-auto hide-scrollbar px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-6 animate-in fade-in duration-300">
      <section>
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Sun className="text-[#A39D78]" size={20} />
          每日天氣預測
        </h3>
        
        {isLoadingWeather ? (
          <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#773690]">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span className="font-bold text-sm">更新最新氣象資料中...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayData.map((w, i) => (
               <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md">
                 <div className="flex flex-col items-center justify-center min-w-[70px]">
                   <span className="text-xs text-gray-500 mb-1.5">{w.day} ({w.weekday})</span>
                   <div className="mb-1.5">
                     {getWeatherIcon(w.condition, { size: 28 })}
                   </div>
                   <span className="text-sm font-bold text-gray-800">{w.temp}</span>
                 </div>
                 
                 <div className="flex-1 flex flex-col justify-center border-l border-gray-100 pl-4 py-1">
                   <span className="text-sm text-[#A39D78] font-bold mb-1.5">{w.desc}</span>
                   {w.clothingHint && (
                     <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-gray-50">
                       <span className="text-[11px] text-gray-600 leading-snug block">{w.clothingHint}</span>
                     </div>
                   )}
                 </div>
               </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('itinerary');
  const [user, setUser] = useState(null);
  
  const [weatherData, setWeatherData] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  
  const getInitialPackingList = () => {
    try {
      const saved = localStorage.getItem('nagoya_packing');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return defaultPackingList;
  };
  const [packingList, setPackingList] = useState(getInitialPackingList());
  const [isListLoaded, setIsListLoaded] = useState(false);
  
  const getInitialItinerary = () => {
    try {
      const saved = localStorage.getItem('nagoya_itinerary');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return mockData.itinerary;
  };
  const [itineraryData, setItineraryData] = useState(getInitialItinerary());
  
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!auth) {
      setUser({ uid: 'safari-offline-user' });
      setIsLoadingWeather(true);
      fetchRealWeather().then(data => {
        if (data && Array.isArray(data)) {
          setWeatherData(data);
        }
        setIsLoadingWeather(false);
      });
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.warn("Firebase 登入失敗，切換至離線模式");
        setUser({ uid: 'safari-offline-user' });
      }
    };
    initAuth();
    
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
    
    setIsLoadingWeather(true);
    fetchRealWeather().then(data => {
      if (data && Array.isArray(data)) {
        setWeatherData(data);
      }
      setIsLoadingWeather(false);
    });
    
    return () => unsubscribeAuth && unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!db) {
      setIsListLoaded(true);
      return;
    }

    try {
      const packRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'packingList');
      const unsubPacking = onSnapshot(packRef, (docSnap) => {
        if (docSnap.exists()) {
          setPackingList(docSnap.data());
        } else {
          setDoc(packRef, defaultPackingList).catch(e => console.warn(e));
        }
        setIsListLoaded(true);
      }, (error) => {
        console.warn("Firestore 讀取被阻擋:", error);
        setIsListLoaded(true);
      });

      const itinRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'itinerary');
      const unsubItin = onSnapshot(itinRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().data) {
          setItineraryData(docSnap.data().data);
        } else {
          setDoc(itinRef, { data: mockData.itinerary }).catch(e => console.warn(e));
        }
      }, (error) => {
        console.warn("Firestore 行程讀取被阻擋:", error);
      });

      return () => {
        unsubPacking();
        unsubItin();
      }
    } catch(e) {
      console.warn("Firestore 初始化例外:", e);
      setIsListLoaded(true);
    }
  }, [user]);

  const updateFirestorePacking = async (newList) => {
    try { localStorage.setItem('nagoya_packing', JSON.stringify(newList)); } catch(e) {}
    if (!user || !db) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'packingList');
      await setDoc(docRef, newList);
    } catch(e) {
      console.warn("儲存受阻:", e);
    }
  };

  const updateFirestoreItinerary = async (newData) => {
    try { localStorage.setItem('nagoya_itinerary', JSON.stringify(newData)); } catch(e) {}
    if (!user || !db) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'itinerary');
      await setDoc(docRef, { data: newData });
    } catch(e) {
      console.warn("行程儲存受阻:", e);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap');
        body {
          font-family: 'Zen Maru Gothic', sans-serif;
          background-color: #f1f5f9; 
          background-image: radial-gradient(#d1d5db 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="min-h-[100dvh] flex justify-center text-gray-800 sm:py-6 sm:px-4">
        <div className="w-full max-w-md bg-[#FAF9F6] h-[100dvh] sm:h-auto sm:h-[850px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] sm:rounded-[2.5rem] relative flex flex-col overflow-hidden sm:border-[8px] sm:border-gray-50">
          
          <header className="flex-shrink-0 bg-white px-5 py-4 shadow-sm z-20 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h1 className="text-[1.1rem] font-bold text-[#773690] leading-tight">
                {mockData.tripInfo.title}
              </h1>
              <p className="text-xs text-[#A39D78] mt-0.5 font-medium">
                {mockData.tripInfo.dates}
              </p>
            </div>
            <div className="w-10 h-10 bg-[#773690]/10 rounded-full flex items-center justify-center">
              <Plane className="text-[#773690]" size={20} />
            </div>
          </header>

          <main className="flex-1 relative overflow-hidden bg-[#FAF9F6]">
            {activeTab === 'itinerary' && (
              <ItineraryView 
                user={user} 
                weatherData={weatherData} 
                isLoadingWeather={isLoadingWeather}
                setPreviewImage={setPreviewImage}
                itineraryData={itineraryData}
                setItineraryData={setItineraryData}
                updateFirestoreItinerary={updateFirestoreItinerary}
              />
            )}
            {activeTab === 'guide' && (
              <GuideView 
                user={user}
                packingList={packingList}
                setPackingList={setPackingList}
                isListLoaded={isListLoaded}
                updateFirestore={updateFirestorePacking}
              />
            )}
            {activeTab === 'weather' && (
              <WeatherView 
                weatherData={weatherData} 
                isLoadingWeather={isLoadingWeather} 
              />
            )}
          </main>

          <nav className="flex-shrink-0 w-full bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 pb-[env(safe-area-inset-bottom)] relative">
            <div className="flex justify-around items-center h-16 px-2">
              <button onClick={() => setActiveTab('itinerary')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'itinerary' ? 'text-[#773690]' : 'text-gray-400 hover:text-gray-600'}`}>
                <div className={`p-1 rounded-full mb-0.5 transition-all ${activeTab === 'itinerary' ? 'bg-[#773690]/10 scale-110' : ''}`}><MapPin size={22} strokeWidth={activeTab === 'itinerary' ? 2.5 : 2} /></div>
                <span className="text-[10px] font-bold">行程</span>
              </button>
              <button onClick={() => setActiveTab('guide')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'guide' ? 'text-[#773690]' : 'text-gray-400 hover:text-gray-600'}`}>
                <div className={`p-1 rounded-full mb-0.5 transition-all ${activeTab === 'guide' ? 'bg-[#773690]/10 scale-110' : ''}`}><FileText size={22} strokeWidth={activeTab === 'guide' ? 2.5 : 2} /></div>
                <span className="text-[10px] font-bold">指南</span>
              </button>
              <button onClick={() => setActiveTab('weather')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'weather' ? 'text-[#773690]' : 'text-gray-400 hover:text-gray-600'}`}>
                <div className={`p-1 rounded-full mb-0.5 transition-all ${activeTab === 'weather' ? 'bg-[#773690]/10 scale-110' : ''}`}><Sun size={22} strokeWidth={activeTab === 'weather' ? 2.5 : 2} /></div>
                <span className="text-[10px] font-bold">天氣</span>
              </button>
            </div>
          </nav>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[100] flex justify-center bg-black/90 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
          <div className="w-full max-w-md relative flex items-center justify-center p-4">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/50 rounded-full p-2 backdrop-blur-sm transition-colors z-10"
            >
              <X size={24} />
            </button>
            <img
              src={previewImage}
              alt="預覽照片放大"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}