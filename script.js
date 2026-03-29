const removeAccents = (str) => {
return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
};
    const { useState, useEffect, useMemo, useRef } = React;

const calculateSRS = (currentData, quality) => {
  let { level = 0, easeFactor = 2.5, nextReview } = currentData || {};
  const now = Date.now();
  if (nextReview && nextReview > now) {
      if (quality === 1) return currentData;
  }
 
  if (quality === 0) {
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    
    return {
      level: 0,           
      easeFactor: easeFactor, 
      nextReview: 0,     
      isDone: false
    };

  } else {
    // === BẤM NÚT "ĐÃ BIẾT" (XANH) ===

    let newInterval;

  
    if (!nextReview || nextReview === 0 || level === 0) {
        newInterval = 1; 
    } 
  
    else {

        newInterval = Math.ceil(level * easeFactor);

        easeFactor = Math.min(2.5, easeFactor + 0.1); 
    }

    // --- XỬ LÝ 5 GIỜ SÁNG ---
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newInterval);
    nextDate.setHours(5, 0, 0, 0);

    return {
      level: newInterval, 
      easeFactor: easeFactor,
      nextReview: nextDate.getTime(),
      isDone: false 
    };
  }
};

// --- FETCH DATA FROM GITHUB --- 
const fetchDataFromGithub = async () => {
  try { 
    // 1. Tải các file cơ sở dữ liệu chính (Đã gỡ bỏ onkun.json và vocab.json)
    const [dbResponse, tuvungResponse, exceptionResponse, onkunResponse, bothuResponse] = await Promise.all([
      fetch('./data/kanji_db.json'),
      fetch('./data/tuvungg.json'),
      fetch('./data/dongtu_dacbiet.json'),
      fetch('./data/onkun.json'),
      fetch('./data/bothu_kanji.json')
    ]);

    // 2. Tải thêm 5 file danh sách cấp độ (N5 -> N1)
    const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
    const levelPromises = levels.map(l => fetch(`./data/kanji${l}.json`));
    const levelResponses = await Promise.all(levelPromises);

    let kanjiDb = null;
    let kanjiLevels = {}; 
    if (dbResponse.ok) kanjiDb = await dbResponse.json();

    // Xử lý file Từ vựng
    let tuvungDb = {};
    if (tuvungResponse && tuvungResponse.ok) {
        tuvungDb = await tuvungResponse.json();
    }

    // Xử lý file Động từ đặc biệt
    let exceptionDb = {};
    if (exceptionResponse && exceptionResponse.ok) {
        exceptionDb = await exceptionResponse.json();
    }

      let onkunDb = {};
    if (onkunResponse && onkunResponse.ok) onkunDb = await onkunResponse.json();

    let bothuDb = {}; 
    if (bothuResponse && bothuResponse.ok) bothuDb = await bothuResponse.json();
      
    // Xử lý 5 file cấp độ
    for (let i = 0; i < levels.length; i++) {
        const lvlKey = levels[i].toUpperCase();
        if (levelResponses[i].ok) {
            const text = await levelResponses[i].text();
            kanjiLevels[lvlKey] = Array.from(new Set(text.replace(/["\n\r\s,\[\]]/g, '').split('')));
        } else {
            kanjiLevels[lvlKey] = [];
        }
    }

    // Trả về dữ liệu gộp (Đã gỡ bỏ ONKUN_DB và VOCAB_DB)
    return { 
        ...kanjiDb, 
        TUVUNG_DB: tuvungDb, 
        KANJI_LEVELS: kanjiLevels, 
        EXCEPTION_VERBS: exceptionDb,
        ONKUN_DB: onkunDb,
        BOTHU_DB: bothuDb
    }; 
  } catch (error) {
    console.error("Lỗi tải dữ liệu hệ thống:", error);
    return null;
  }
};
    // --- UTILS & DATA FETCHING ---

    const getHex = (char) => char.codePointAt(0).toString(16).toLowerCase().padStart(5, '0');

    

    
   const fetchKanjiData = async (char) => {
    const hex = getHex(char);
    
  
    const sources = [
      `./data/svg/${hex}.svg`,  
      `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${hex}.svg`,
      `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${hex}-Kaisho.svg`,
      `https://cdn.jsdelivr.net/gh/parsimonhi/animCJK@master/svgsKana/${hex}.svg`,
      `https://cdn.jsdelivr.net/gh/parsimonhi/animCJK@master/svgsJa/${hex}.svg`
    ];

    for (const url of sources) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          
          if (text.includes('<svg')) {
             return { success: true, svg: text, source: url };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false };
  };

    
    const useKanjiSvg = (char) => {
    const [state, setState] = useState({ 
        loading: true, 
        paths: [], 
        fullSvg: null, 
        failed: false 
    });
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        if (!char) return;

        setState({ loading: true, paths: [], fullSvg: null, failed: false });

        fetchKanjiData(char).then((result) => {
        if (!mounted.current) return;

        if (result.success) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(result.svg, "image/svg+xml");
            
            
            const pathElements = Array.from(doc.querySelectorAll('path'));
            const pathData = pathElements.map(p => p.getAttribute('d')).filter(d => d);
            
        
            const svgString = new XMLSerializer().serializeToString(doc.documentElement);

            setState({
            loading: false,
            paths: pathData,
            fullSvg: svgString,
            failed: false
            });
        } else {
            setState({
            loading: false,
            paths: [],
            fullSvg: null,
            failed: true
            });
        }
        });

        return () => { mounted.current = false; };
    }, [char]);

    return state;
    };

const VerbEngine = {
    // 1. Bảng chuyển đổi Hiragana (Dùng cho Nhóm 1)
    HIRA_MAP: {
        'i': ['い','き','ぎ','し','じ','ち','ぢ','に','ひ','び','ぴ','み','り'],
        'u': ['う','く','ぐ','す','ず','つ','づ','ぬ','ふ','ぶ','ぷ','む','る'],
        'a': ['わ','か','が','さ','ざ','た','だ','な','は','ば','ぱ','ま','ら'],
        'e': ['え','け','げ','せ','ぜ','て','で','ね','へ','べ','ぺ','め','れ'],
        'o': ['お','こ','ご','そ','ぞ','と','ど','の','ほ','ぼ','ぽ','も','ろ']
    },

    shiftHira: (char, toColumn) => {
        const idx = VerbEngine.HIRA_MAP['i'].indexOf(char);
        return idx !== -1 ? VerbEngine.HIRA_MAP[toColumn][idx] : char;
    },

   parseVmasu: (vmasu, dbData) => { 
        if (!vmasu.endsWith("ます")) return null;

        const stem = vmasu.slice(0, -2);
        const lastChar = stem.slice(-1);

        // 1. Kiểm tra danh sách ngoại lệ trước
        if (dbData && dbData.EXCEPTION_VERBS && dbData.EXCEPTION_VERBS[vmasu]) {
            return { vmasu, stem, lastChar, ...dbData.EXCEPTION_VERBS[vmasu] };
        }

        // 2. Bộ lọc thông minh: Cho phép Kanji, Katakana, hoặc động từ đuôi します (như がっかりします)
        const hasKanji = /[\u4E00-\u9FAF]/.test(vmasu);
        const hasKatakana = /[\u30A0-\u30FF]/.test(vmasu);
        if (!hasKanji && !hasKatakana && !vmasu.endsWith("します")) {
            return { error: "Yêu cầu nhập Kanji, không nhập nguyên Hiragana." };
        }

        if (vmasu === "来ます" || vmasu === "きます") return { vmasu, stem, lastChar, group: 3, vru: "くる" };
        
        // 3. PHÂN BIỆT THÔNG MINH NHÓM 1 VÀ NHÓM 3
        if (stem.endsWith("し")) {
            // Danh sách bảo vệ động từ ghép Nhóm 1
            const group1Suffixes = [
                "出し", "返し", "直し", "落とし", "渡し", "通し", 
                "越し", "超し", "尽くし", "指し", "逃し", "壊し", 
                "隠し", "残し", "こぼし", "殺し", "外し", "増やし", "減らし"
            ];
            const isGroup1 = group1Suffixes.some(suffix => stem.endsWith(suffix));

            // Đếm số lượng chữ Kanji
            const kanjiCount = (stem.match(/[\u4E00-\u9FAF]/g) || []).length;

            // BẮT NHÓM 3 NẾU: Không thuộc danh sách bảo vệ VÀ (Có Katakana HOẶC Có từ 2 Kanji trở lên HOẶC Thuần Hiragana dài)
            if (!isGroup1 && (hasKatakana || kanjiCount >= 2 || (!hasKanji && stem.length > 2))) {
                return { vmasu, stem, lastChar, group: 3, vru: stem.slice(0, -1) + "する" };
            }
        }

        // 4. Logic chia Nhóm 2 và Nhóm 1 cơ bản
        const isKanjiLastChar = /[\u4E00-\u9FAF]/.test(lastChar); // Kiểm tra xem sát nách ます có phải Kanji không (VD: 寝, 見, 出)

        if (VerbEngine.HIRA_MAP['e'].includes(lastChar) || isKanjiLastChar || lastChar === 'じ') {
            // NẾU thuộc cột 'e' HOẶC là Kanji -> Chắc chắn là Nhóm 2
            return { vmasu, stem, lastChar, group: 2, vru: stem + "る" };
        } else if (VerbEngine.HIRA_MAP['i'].includes(lastChar)) {
            // NẾU thuộc cột 'i' -> Nhóm 1
            const uChar = VerbEngine.shiftHira(lastChar, 'u');
            return { vmasu, stem, lastChar, group: 1, vru: stem.slice(0, -1) + uChar };
        }
        
        return null;
    },
    deriveMasuReading: (vruReading, group) => {
        if (!vruReading) return "";
        if (vruReading === "くる") return "きます";
        if (vruReading.endsWith("する") && group === 3) return vruReading.slice(0, -2) + "します";
        if (group === 2) return vruReading.slice(0, -1) + "ます";
        if (group === 1) {
            const lastChar = vruReading.slice(-1);
            const idx = VerbEngine.HIRA_MAP['u'].indexOf(lastChar);
            if (idx !== -1) {
                const iChar = VerbEngine.HIRA_MAP['i'][idx];
                return vruReading.slice(0, -1) + iChar + "ます";
            }
        }
        return "";
    },

    // 3. TÍCH HỢP LOGIC CHIA 11 THỂ TỪ SOURCE TYPESCRIPT
    conjugate: (vmasuReading, parsedData, targetForm) => {
        const stemReading = vmasuReading.slice(0, -2); // Bỏ 'ます'
        const lastCharI = stemReading.slice(-1); // Chữ cái cuối (Cột i)

        // Khôi phục về thể từ điển (V-ru) để dễ chia
        let vruReading = "";
        let tailU = "";
        let stemBase = "";

        if (parsedData.group === 3) {
            if (vmasuReading === "きます") vruReading = "くる";
            else if (vmasuReading === "来ます") vruReading = "来る"; 
            else vruReading = stemReading.slice(0, -1) + "する";
        } else if (parsedData.group === 2) {
            vruReading = stemReading + "る";
            stemBase = stemReading;
        } else if (parsedData.group === 1) {
            tailU = VerbEngine.shiftHira(lastCharI, 'u');
            vruReading = stemReading.slice(0, -1) + tailU;
            stemBase = stemReading.slice(0, -1);
        }

        // --- CHIA NHÓM 3 ---
        if (parsedData.group === 3) {
            const isKuruKanji = vmasuReading === "来ます";
            const isKuruKana = vmasuReading === "きます";
            const sSuru = stemReading.slice(0, -1); 

            switch (targetForm) {
                case "Te": return isKuruKanji ? "来て" : isKuruKana ? "きて" : sSuru + "して";
                case "Ta": return isKuruKanji ? "来た" : isKuruKana ? "きた" : sSuru + "した";
                case "Nai": return isKuruKanji ? "来ない" : isKuruKana ? "こない" : sSuru + "しない";
                case "Dictionary": return isKuruKanji ? "来る" : isKuruKana ? "くる" : vruReading;
                case "Ba": return isKuruKanji ? "来れば" : isKuruKana ? "くれば" : sSuru + "すれば";
                case "Volitional": return isKuruKanji ? "来よう" : isKuruKana ? "こよう" : sSuru + "しよう";
                case "Imperative": return isKuruKanji ? "来い" : isKuruKana ? "こい" : sSuru + "しろ";
                case "Prohibitive": return isKuruKanji ? "来るな" : isKuruKana ? "くるな" : vruReading + "な";
                case "Potential": return isKuruKanji ? "来られる" : isKuruKana ? "こられる" : sSuru + "できる";
                case "Passive": return isKuruKanji ? "来られる" : isKuruKana ? "こられる" : sSuru + "される";
                case "Causative": return isKuruKanji ? "来させる" : isKuruKana ? "こさせる" : sSuru + "させる";
                case "CausativePassive": return isKuruKanji ? "来させられる" : isKuruKana ? "こさせられる" : sSuru + "させられる";
                
                default: return stemReading;
            }
        
        }

        // --- CHIA NHÓM 2 ---
        if (parsedData.group === 2) {
            switch (targetForm) {
                case "Te": return stemBase + "て";
                case "Ta": return stemBase + "た";
                case "Nai": return stemBase + "ない";
                case "Dictionary": return vruReading;
                case "Ba": return stemBase + "れば";
                case "Volitional": return stemBase + "よう";
                case "Imperative": return stemBase + "ろ";
                case "Prohibitive": return vruReading + "な";
                case "Potential": return stemBase + "られる";
                case "Passive": return stemBase + "られる";
                case "Causative": return stemBase + "させる";
                case "CausativePassive": return stemBase + "させられる";
                
                default: return stemReading;
            }
        }

        // --- CHIA NHÓM 1 ---
        if (parsedData.group === 1) {
            // Nhóm Te / Ta (Âm ngắt, âm mũi...)
            if (targetForm === "Te" || targetForm === "Ta") {
                const sTe = targetForm === "Te" ? "て" : "た";
                const sDe = targetForm === "Te" ? "で" : "だ";

                if (vruReading.endsWith("いく") || vruReading.endsWith("行く")) return stemBase + "っ" + sTe; 
                if (["う", "つ", "る"].includes(tailU)) return stemBase + "っ" + sTe;
                if (["む", "ぶ", "ぬ"].includes(tailU)) return stemBase + "ん" + sDe;
                if (tailU === "く") return stemBase + "い" + sTe;
                if (tailU === "ぐ") return stemBase + "い" + sDe;
                if (tailU === "す") return stemBase + "し" + sTe;
            }

            // Các nhóm còn lại (Sử dụng shift Hiragana)
            const shift = (vowel) => VerbEngine.shiftHira(lastCharI, vowel);

            switch (targetForm) {
                case "Nai": return stemBase + (tailU === "う" ? "わ" : shift('a')) + "ない";
                case "Dictionary": return vruReading;
                case "Ba": return stemBase + shift('e') + "ば";
                case "Volitional": return stemBase + shift('o') + "う";
                case "Imperative": return stemBase + shift('e');
                case "Potential": return stemBase + shift('e') + "る";
                case "Passive": return stemBase + (tailU === "う" ? "わ" : shift('a')) + "れる";
                case "Causative": return stemBase + (tailU === "う" ? "わ" : shift('a')) + "せる";
                case "CausativePassive": {
                    const aCol = tailU === "う" ? "わ" : shift('a');
                    if (tailU === "す") {
                        return stemBase + aCol + "せられる";
                    } else {
                  
                        return stemBase + aCol + "せられる / " + stemBase + aCol + "される";
                    }
                }
                case "Prohibitive": return vruReading + "な";
                default: return stemReading;
            }
        }
        return stemReading;
    }
};

// --- COMPONENT: BẢNG LỊCH TRÌNH ÔN TẬP (UI MONOCHROME HIỆN ĐẠI) ---
const ReviewListModal = ({ isOpen, onClose, srsData, onResetSRS, onLoadChars, dbData }) => {
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const [isHelpOpen, setIsHelpOpen] = React.useState(false);

    // Tính toán tiến độ
    const levelProgress = React.useMemo(() => {
        if (!dbData || !dbData.KANJI_LEVELS) return [];
        const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
        const result = [];
        
        levels.forEach(lvl => {
            const totalChars = dbData.KANJI_LEVELS[lvl] || [];
            const totalCount = totalChars.length;
            if (totalCount === 0) return;

            const learnedCount = totalChars.filter(char => srsData && srsData[char]).length;

            if (learnedCount > 0) {
                result.push({ 
                    level: lvl, 
                    learned: learnedCount, 
                    total: totalCount,
                    percent: Math.round((learnedCount / totalCount) * 100)
                });
            }
        });
        return result;
    }, [srsData, dbData]);

    // Đổi màu thanh tiến độ thành Monochrome (Đen - Xám)
    const levelColors = {
        N5: { bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-200', bar: 'bg-gray-900' },
        N4: { bg: 'bg-white', text: 'text-gray-800', border: 'border-gray-200', bar: 'bg-gray-800' },
        N3: { bg: 'bg-white', text: 'text-gray-700', border: 'border-gray-200', bar: 'bg-gray-700' },
        N2: { bg: 'bg-white', text: 'text-gray-600', border: 'border-gray-200', bar: 'bg-gray-600' },
        N1: { bg: 'bg-white', text: 'text-gray-500', border: 'border-gray-200', bar: 'bg-gray-500' }
    };

    const handleExport = () => {
        const data = localStorage.getItem('phadao_srs_data');
        if (!data || data === '{}') {
            alert("Chưa có dữ liệu để sao lưu!");
            return;
        }
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const date = new Date();
        const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
        const fileName = `backup_tiengnhat_${dateStr}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = event.target.result;
                JSON.parse(json); 
                if (confirm("⚠️ CẢNH BÁO:\nDữ liệu hiện tại sẽ bị thay thế hoàn toàn bởi bản sao lưu này.\nBạn có chắc chắn muốn khôi phục không?")) {
                    localStorage.setItem('phadao_srs_data', json);
                    alert("Khôi phục thành công! Trang web sẽ tải lại.");
                    window.location.reload();
                }
            } catch (err) {
                alert("File lỗi! Vui lòng chọn đúng file .json");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };
    
    React.useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    React.useEffect(() => {
        if (!isOpen) {
            setIsConfirmOpen(false);
            setIsHelpOpen(false);
        }
    }, [isOpen]);

    const groupedData = React.useMemo(() => {
        const groups = { today: [] }; 
        const now = Date.now();
        Object.entries(srsData || {}).forEach(([char, data]) => {
            if ((!data.nextReview && data.nextReview !== 0) || (data.isDone === true)) return;
            if (data.nextReview === 0 || data.nextReview <= now) {
                groups.today.push(char);
            } else {
                const dateObj = new Date(data.nextReview);
                const dateKey = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
                if (!groups[dateKey]) groups[dateKey] = [];
                groups[dateKey].push(char);
            }
        });
        return groups;
    }, [srsData, isOpen]);

    if (!isOpen) return null;

    const futureDates = Object.keys(groupedData).filter(k => k !== 'today').sort((a, b) => {
        const [d1, m1] = a.split('/').map(Number);
        const [d2, m2] = b.split('/').map(Number);
        return m1 === m2 ? d1 - d2 : m1 - m2;
    }).slice(0, 5);

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 cursor-pointer" onClick={onClose}>
            <div className={`bg-white rounded-3xl shadow-2xl w-full flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 overflow-hidden relative cursor-default border border-gray-200 ${isConfirmOpen ? 'max-w-[320px]' : 'max-w-md'}`} onClick={e => e.stopPropagation()}>
                
                {isHelpOpen ? (
                    // === UI 1: HƯỚNG DẪN SAO LƯU (MONOCHROME) ===
                    <>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-sm font-black text-gray-900 uppercase flex items-center gap-2 tracking-widest">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                                HƯỚNG DẪN ÔN TẬP
                            </h3>
                            <button onClick={() => setIsHelpOpen(false)} className="text-gray-400 hover:text-gray-900 bg-white hover:bg-gray-200 rounded-full p-1.5 transition-colors shadow-sm border border-gray-200">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar text-sm text-gray-600 space-y-6 flex-1 bg-white">
                            {/* Mục 1 */}
                            <div>
                                <h4 className="font-black text-gray-900 mb-2 flex items-center gap-2 uppercase text-xs tracking-wider">
                                    <span className="w-4 h-4 rounded bg-gray-900 text-white flex items-center justify-center text-[10px]">1</span> 
                                    PHƯƠNG PHÁP HỌC
                                </h4>
                                <p className="text-sm leading-relaxed text-justify text-gray-500 border-l-2 border-gray-200 pl-3 ml-2">
                                    Hệ thống sử dụng thuật toán <strong className="text-gray-900">Lặp lại ngắt quãng</strong> (Spaced Repetition) tích hợp vào <b>FLASHCARD KANJI</b>. Thay vì học nhồi nhét, hệ thống sẽ tính toán <strong className="text-gray-900">"thời điểm lãng quên"</strong> của não bộ để nhắc bạn ôn lại đúng lúc bạn sắp quên.
                                </p>
                            </div>

                            {/* Mục 2 */}
                            <div>
                                <h4 className="font-black text-gray-900 mb-2 flex items-center gap-2 uppercase text-xs tracking-wider">
                                    <span className="w-4 h-4 rounded bg-gray-900 text-white flex items-center justify-center text-[10px]">2</span> 
                                    CƠ CHẾ HOẠT ĐỘNG
                                </h4>
                                <div className="text-gray-500 leading-relaxed border-l-2 border-gray-200 pl-3 ml-2 space-y-2">
                                    <p>
                                        Hệ thống tự động tính toán <strong className="text-gray-900">mức độ ghi nhớ</strong> của bạn đối với từng Kanji. Từ đó đưa ra lịch trình ôn tập phù hợp riêng cho từng chữ.
                                    </p>
                                    <div className="flex gap-2 items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <svg className="w-4 h-4 text-gray-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                        <span className="text-xs"><b>Nhắc nhở:</b> Thông báo sẽ tự động xuất hiện trên giao diện web khi đến hạn ôn tập (vào lúc 5 giờ sáng hàng ngày).</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Mục 3 */}
                            <div>
                                <h4 className="font-black text-gray-900 mb-2 flex items-center gap-2 uppercase text-xs tracking-wider">
                                    <span className="w-4 h-4 rounded bg-gray-900 text-white flex items-center justify-center text-[10px]">3</span> 
                                    LƯU Ý DỮ LIỆU
                                </h4>
                                <ul className="list-disc list-outside space-y-2 text-gray-500 border-l-2 border-gray-200 pl-6 ml-2">
                                    <li><strong className="text-gray-900">Lưu trữ:</strong> Dữ liệu học tập được lưu trực tiếp trên Trình duyệt của thiết bị bạn đang dùng.</li>
                                    <li><strong className="text-gray-900">Dung lượng:</strong> Cực kỳ nhẹ! Toàn bộ Kanji chỉ chiếm khoảng vài trăm KB, không gây nặng máy.</li>
                                    <li className="text-red-600 font-medium">Cảnh báo: Dữ liệu sẽ mất nếu bạn Xóa lịch sử duyệt web hoặc dùng Tab ẩn danh. Hãy dùng trình duyệt thường để học nhé!</li>
                                </ul>
                            </div>
                                
                            {/* Mục 4: Sao lưu */}
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                <h4 className="font-black text-gray-900 mb-2 flex items-center gap-2 uppercase text-xs tracking-wider">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                                    SAO LƯU & KHÔI PHỤC
                                </h4>
                                
                                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                    Dùng để chuyển dữ liệu sang máy khác, hoặc phòng trường hợp lỡ tay xóa lịch sử duyệt web.
                                </p>

                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={handleExport}
                                        className="flex flex-col items-center justify-center gap-1.5 py-3 bg-white border border-gray-200 text-gray-900 font-bold rounded-xl shadow-sm hover:border-gray-900 hover:shadow-md transition-all active:scale-95 group"
                                    >
                                        <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                        <span className="text-xs">TẢI BẢN SAO</span>
                                    </button>

                                    <label className="flex flex-col items-center justify-center gap-1.5 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-sm hover:bg-black hover:shadow-md transition-all active:scale-95 cursor-pointer">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                        <span className="text-xs">KHÔI PHỤC</span>
                                        <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 bg-gray-50">
                            <button onClick={() => setIsHelpOpen(false)} className="w-full py-4 bg-gray-900 hover:bg-black text-white font-black rounded-xl shadow-lg transition-all active:scale-[0.98] text-xs uppercase tracking-widest">
                                Đã hiểu & Quay lại
                            </button>
                        </div>
                    </>

                ) : !isConfirmOpen ? (
                    // === UI 2: DANH SÁCH ÔN TẬP CHÍNH ===
                    <>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex flex-col">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    Lịch trình ôn tập
                                </h3>
                                <button onClick={() => setIsHelpOpen(true)} className="text-[10px] font-bold text-gray-400 hover:text-gray-900 underline underline-offset-2 mt-1 text-left w-fit transition-colors">
                                    Xem hướng dẫn & Sao lưu
                                </button>
                            </div>
                            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-6">
                            
                            {/* TIẾN ĐỘ HỌC TẬP */}
                            {levelProgress.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Tiến độ KANJI</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {levelProgress.map((item) => {
                                            const style = levelColors[item.level] || levelColors.N5;
                                            return (
                                                <div 
                                                    key={item.level} 
                                                    className={`${style.bg} border ${style.border} rounded-xl p-3 flex flex-col justify-center flex-1 min-w-[40%] shadow-sm`}
                                                >
                                                    <div className="flex justify-between items-end mb-2">
                                                        <span className={`text-xs font-black ${style.text}`}>{item.level}</span>
                                                        <span className={`text-[10px] font-bold text-gray-400`}>
                                                            {item.learned}/{item.total}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${style.bar} transition-all duration-1000 ease-out`} 
                                                            style={{ width: `${item.percent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* CẦN ÔN NGAY (TÔNG ĐỎ) */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                        Cần ôn ngay ({groupedData.today.length})
                                    </h4>
                                    {groupedData.today.length > 0 && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onLoadChars(groupedData.today.join(''));
                                            }}
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-lg transition-all active:scale-95 uppercase tracking-wider shadow-md shadow-red-200 flex items-center gap-1"
                                        >
                                            Ôn ngay
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                        </button>
                                    )}
                                </div>
                                
                                <div className={`p-4 rounded-2xl border ${groupedData.today.length > 0 ? 'bg-red-50/50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                                    {groupedData.today.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {groupedData.today.map((char, i) => (
                                                <span key={i} className="inline-flex items-center justify-center bg-white text-red-700 border border-red-200 rounded-lg w-8 h-9 text-xl font-['Klee_One'] shadow-sm">{char}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 font-medium text-center py-2 flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                            Tuyệt vời! Bạn không có kanji cần ôn hôm nay.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* LỊCH SẮP TỚI */}
                            {futureDates.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Lịch sắp tới</h4>
                                    <div className="space-y-3">
                                        {futureDates.map(date => (
                                            <div key={date} className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-sm hover:border-gray-300 transition-colors">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                                                        Ngày {date}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-400 text-[10px] font-bold">{groupedData[date].length} chữ</span>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onLoadChars(groupedData[date].join(''));
                                                            }}
                                                            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all active:scale-90"
                                                            title="Tạo bài học trước cho ngày này"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {groupedData[date].map((char, i) => (
                                                        <span key={i} className="inline-flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-100 rounded-md w-7 h-8 text-lg font-['Klee_One']">{char}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RESET DỮ LIỆU */}
                        <div className="p-4 border-t border-gray-100 bg-white flex justify-center">
                            <button 
                                onClick={() => {
                                    if (!srsData || Object.keys(srsData).length === 0) {
                                        alert("Danh sách trống!");
                                        return;
                                    }
                                    setIsConfirmOpen(true);
                                }}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                Reset toàn bộ tiến độ
                            </button>
                        </div>
                    </>
                ) : (
                    // === UI 3: CẢNH BÁO XÓA ===
                    <div 
                        className="p-8 text-center flex flex-col items-center justify-center bg-white"
                        onClick={(e) => {
                            e.stopPropagation(); 
                            setIsConfirmOpen(false); 
                        }}
                    >
                        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-5 border-[4px] border-white shadow-[0_0_0_4px_rgba(254,226,226,1)] animate-bounce">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-wide">Cảnh báo</h3>
                        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                            Toàn bộ lịch sử ôn tập Flashcard sẽ bị <b className="text-red-600">xóa vĩnh viễn</b>.<br/>Hành động này không thể hoàn tác!
                        </p>
                        
                        <div className="flex flex-col gap-3 w-full">
                            <button onClick={() => setIsConfirmOpen(false)} className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest">
                                Không xóa nữa
                            </button>
                            <button onClick={() => { onResetSRS(); setIsConfirmOpen(false); onClose(); }} className="w-full py-3 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 font-bold rounded-xl transition-all text-xs uppercase tracking-wider">
                                Vẫn xóa dữ liệu
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
 // --- BỘ CHUYỂN ĐỔI KANA ---
    const convertToKana = (rawText, targetKanaString) => {
        const hiraMap = {
            'a':'あ','i':'い','u':'う','e':'え','o':'お','ka':'か','ki':'き','ku':'く','ke':'け','ko':'こ','sa':'さ','shi':'し','si':'し','su':'す','se':'せ','so':'そ','ta':'た','chi':'ち','ti':'ち','tsu':'つ','tu':'つ','te':'て','to':'と','na':'な','ni':'に','nu':'ぬ','ne':'ね','no':'の','ha':'は','hi':'ひ','fu':'ふ','hu':'ふ','he':'へ','ho':'ほ','ma':'ま','mi':'み','mu':'む','me':'め','mo':'も','ya':'や','yu':'ゆ','yo':'よ','ra':'ら','ri':'り','ru':'る','re':'れ','ro':'ろ','wa':'わ','wo':'を','nn':'ん','ga':'が','gi':'ぎ','gu':'ぐ','ge':'げ','go':'ご','za':'ざ','ji':'じ','zi':'じ','zu':'ず','ze':'ぜ','zo':'ぞ','da':'だ','di':'ぢ','du':'づ','de':'で','do':'ど','ba':'ば','bi':'び','bu':'ぶ','be':'べ','bo':'ぼ','pa':'ぱ','pi':'ぴ','pu':'ぷ','pe':'ぺ','po':'ぽ','kya':'きゃ','kyu':'きゅ','kyo':'きょ','sha':'しゃ','shu':'しゅ','sho':'しょ','sya':'しゃ','syu':'しゅ','syo':'しょ','cha':'ちゃ','chu':'ちゅ','cho':'ちょ','tya':'ちゃ','tyu':'ちゅ','tyo':'ちょ','nya':'にゃ','nyu':'にゅ','nyo':'にょ','hya':'ひゃ','hyu':'ひゅ','hyo':'ひょ','mya':'みゃ','myu':'みゅ','myo':'みょ','rya':'りゃ','ryu':'りゅ','ryo':'りょ','gya':'ぎゃ','gyu':'ぎゅ','gyo':'ぎょ','ja':'じゃ','ju':'じゅ','jo':'じょ','zya':'じゃ','zyu':'じゅ','zyo':'じょ','bya':'びゃ','byu':'びゅ','byo':'びょ','pya':'ぴゃ','pyu':'ぴゅ','pyo':'ぴょ','fa':'ふぁ','fi':'ふぃ','fe':'ふぇ','fo':'ふぉ','va':'ゔぁ','vi':'ゔぃ','vu':'ゔ','ve':'ゔぇ','vo':'ゔぉ','-':'ー'
        };
        let result = rawText.toLowerCase();
    result = result.replace(/([bcdfghjklmpqrstvwxyz])\1/g, (match, p1) => p1 === 'n' ? match : 'っ' + p1);
    const keys = Object.keys(hiraMap).sort((a, b) => b.length - a.length);
    for (let key of keys) { result = result.split(key).join(hiraMap[key]); }
    result = result.replace(/n(?=[bcdfghjklmprstvwz])/g, 'ん');

    // LOGIC MỚI: Khớp từng ký tự với đáp án gốc để phân biệt Hira/Kata
    if (targetKanaString && typeof targetKanaString === 'string') {
        let mixedResult = '';
        for (let i = 0; i < result.length; i++) {
            const char = result[i];
            const targetChar = targetKanaString[i];

            // Nếu chữ ở vị trí tương ứng của đáp án là Katakana -> Chuyển thành Katakana
            if (targetChar && /[\u30A0-\u30FF]/.test(targetChar)) {
                const code = char.charCodeAt(0);
                if (code >= 12353 && code <= 12435) {
                    mixedResult += String.fromCharCode(code + 96);
                } else {
                    mixedResult += char;
                }
            } else {
                mixedResult += char; // Giữ nguyên Hiragana
            }
        }
        return mixedResult;
    }

    return result;
};
const EssayGameModal = ({ isOpen, onClose, text, dbData, mode, onSwitchMode }) => {
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userInput, setUserInput] = useState('');
    const [status, setStatus] = useState('idle'); 
    const [finished, setFinished] = useState(false);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [initialTotal, setInitialTotal] = useState(0); 
    const [correctFirstTimeCount, setCorrectFirstTimeCount] = useState(0);
    const [wrongDetected, setWrongDetected] = useState(false);

    // --- HÀM KHỞI ĐỘNG BÀI HỌC ---
    const initLesson = () => {
        if (!text || !dbData) return;
        
        // BƯỚC QUAN TRỌNG: Reset sạch sành sanh trạng thái cũ trước khi nạp bài mới
        setFinished(false); 
        setCurrentIndex(0);
        setUserInput('');
        setStatus('idle');
        setCorrectFirstTimeCount(0);
        setWrongDetected(false);
        setCorrectAnswer('');

        let items = [];
        if (mode === 'vocab') {
            // FIX LỖI: Bắt buộc từ vựng phải có CẢ cách đọc và ý nghĩa mới được đưa vào game
            items = text.split(/[\n;]+/).map(w => w.trim()).filter(w => {
                const info = dbData.TUVUNG_DB?.[w];
                return info && info.reading && info.meaning;
            });
        } else {
            items = Array.from(new Set(text.replace(/[\n\s]/g, ''))).filter(c => dbData.KANJI_DB?.[c]);
        }

        // FIX LỖI "KẸT STATE": Nếu không có từ nào hợp lệ, báo lỗi và gọi onClose() để dọn dẹp hệ thống
        if (items.length === 0) {
            alert("Không có từ vựng hợp lệ để kiểm tra! Vui lòng bổ sung Ý nghĩa & Cách đọc trước khi học.");
            onClose();
            return;
        }

        const shuffled = items.sort(() => Math.random() - 0.5);
        setQueue(shuffled);
        setInitialTotal(shuffled.length);
    }; 

   

 

    const handleInputChange = (e) => {
        const val = e.target.value;
        if (mode === 'vocab') {
            const currentItem = queue[currentIndex];
            // Lấy chính xác cách đọc của từ đó để làm mốc so sánh
            const targetReading = dbData.TUVUNG_DB[currentItem]?.reading || '';
            setUserInput(convertToKana(val, targetReading));
        } else {
            setUserInput(val.toUpperCase());
        }
    };


    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            setFinished(false); 
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            initLesson();
        }
    }, [isOpen, mode]);
   
    

    const triggerConfetti = React.useCallback(() => {
        if (typeof confetti === 'undefined') return;
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 2000 });
    }, []);

    useEffect(() => { if (finished && isOpen) triggerConfetti(); }, [finished, isOpen]);

    const checkAnswer = () => {
        if (status === 'correct' || finished) return;
        const currentItem = queue[currentIndex];
        let finalInput = userInput.trim();

        if (mode === 'vocab' && finalInput.endsWith('n')) {
            const isKata = checkIsKatakana(dbData.TUVUNG_DB[currentItem]?.reading || '');
            finalInput = finalInput.slice(0, -1) + (isKata ? 'ン' : 'ん');
        }

        // FIX LỖI: Lấy target từ currentItem thay vì currentIndex
        let target = mode === 'kanji' ? (dbData.KANJI_DB[currentItem]?.sound || '') : (dbData.TUVUNG_DB[currentItem]?.reading || '');
        
        let isCorrect = false;
        if (mode === 'kanji') {
            isCorrect = finalInput.toUpperCase() === target.toUpperCase();
        } else {
            isCorrect = removeAccents(finalInput.toLowerCase()) === removeAccents(target.toLowerCase());
        }

        if (status === 'retyping' || status === 'wrong') {
            if (isCorrect) goToNext();
            else { setStatus('wrong'); setTimeout(() => setStatus('retyping'), 400); }
            return;
        }

        if (isCorrect) {
            setStatus('correct');
            if (!wrongDetected) setCorrectFirstTimeCount(prev => prev + 1);
            setTimeout(() => goToNext(), 600);
        } else {
            setCorrectAnswer(target); // Đã có chữ nhờ fix logic target ở trên
            setStatus('wrong');
            setWrongDetected(true);
            setQueue(prev => [...prev, currentItem]);
            setTimeout(() => setStatus('retyping'), 500);
        }
    };

    const goToNext = () => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserInput('');
            setStatus('idle');
            setCorrectAnswer('');
            setWrongDetected(false);
        } else { setFinished(true); }
    };

    if (!isOpen || queue.length === 0) return null;
    const currentItem = queue[currentIndex];
    const info = mode === 'kanji' ? dbData.KANJI_DB[currentItem] : dbData.TUVUNG_DB[currentItem];
    const progressVisual = (correctFirstTimeCount / initialTotal) * 100;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-zinc-900/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
            {!finished ? (
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 flex flex-col items-center border-4 border-zinc-100 relative">
                    <div className="w-full mb-8">
                        <div className="flex justify-between items-center mb-5">
                            <span className="text-[11px] font-black text-zinc-900 bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200/50 shadow-sm">
                                {correctFirstTimeCount} / {initialTotal}
                            </span>
                            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-50 border border-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-90 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div className="h-full bg-zinc-900 transition-all duration-500" style={{ width: `${progressVisual}%` }}></div>
                        </div>
                    </div>

    <div className={`flex flex-col items-center text-center mb-10 transition-all duration-300 ${status === 'correct' ? 'scale-110 opacity-50' : status === 'wrong' ? 'animate-shake' : ''}`}>
    <h2 className={`${mode === 'kanji' ? "text-8xl font-['Klee_One']" : "text-5xl font-bold font-sans"} text-zinc-800 mb-3`}>{currentItem}</h2>
    
    {/* CHỈ HIỆN Ý NGHĨA KHI LÀ TỪ VỰNG */}
    {mode === 'vocab' && (
        <p className="text-lg font-medium text-zinc-400 italic leading-snug px-2">"{info?.meaning}"</p>
    )}
</div>

                    <div className="w-full space-y-4">
                        <input 
                            type="text" autoFocus value={userInput} onChange={handleInputChange}
                            onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                            placeholder={status === 'retyping' ? "Gõ lại chính xác..." : (mode === 'kanji' ? "Nhập âm Hán Việt..." : "Nhập cách đọc...")}
                            className={`w-full p-4 text-center text-xl font-bold border-2 rounded-2xl outline-none transition-all ${status === 'correct' ? 'border-green-500 bg-green-50 text-green-700' : status === 'wrong' || status === 'retyping' ? 'border-red-500 bg-red-50 text-red-700' : 'border-zinc-100 focus:border-zinc-900 bg-zinc-50 shadow-inner'}`}
                        />
                        {(status === 'retyping' || status === 'wrong') && (
                            <div className="animate-in slide-in-from-top-2 duration-300 text-center">
                                <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Đáp án đúng:</p>
                                <div className="inline-block px-5 py-2.5 bg-red-600 text-white rounded-xl font-black text-lg shadow-lg shadow-red-200">{correctAnswer}</div>
                            </div>
                        )}
                        <p className="text-[9px] text-zinc-300 text-center font-bold uppercase tracking-widest pt-2">
                            {status === 'retyping' ? 'Bắt buộc gõ lại từ bị sai' : 'Nhấn Enter để kiểm tra'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] p-8 w-full max-w-[280px] text-center shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95">
                    <div className="text-5xl mb-4 animate-bounce cursor-pointer hover:scale-125 transition-transform" onClick={triggerConfetti}>🎉</div>
                    <h3 className="text-lg font-black text-gray-800 mb-1 uppercase">XUẤT SẮC!</h3>
                    <p className="text-gray-400 mb-6 text-[11px] font-medium italic">Bạn đã hoàn thành bài thi tự luận.</p>
                    <div className="space-y-2">
                        <button onClick={() => { onClose(); onSwitchMode('flashcard'); }} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] shadow-lg active:scale-95 transition-colors">ÔN FLASHCARD</button>
                        <button onClick={() => initLesson()} className="w-full py-3.5 bg-blue-50 border-2 border-blue-100 text-blue-500 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 rounded-xl font-black text-[11px] transition-all active:scale-95">HỌC LẠI TỪ ĐẦU</button>
                        <button onClick={onClose} className="w-full py-3.5 bg-white border-2 border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-600 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95">THOÁT</button>
                    </div>
                </div>
            )}
        </div>
    );
};
// --- BƯỚC 4: FLASHCARD MODAL (FIXED UI TỪ VỰNG) ---
const FlashcardModal = ({ isOpen, onClose, text, dbData, onSrsUpdate, srsData, onSrsRestore, mode }) => { 
    const [originalQueue, setOriginalQueue] = React.useState([]);
    const [queue, setQueue] = React.useState([]);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [isFlipped, setIsFlipped] = React.useState(false);
    const [unknownIndices, setUnknownIndices] = React.useState([]);
    const [knownCount, setKnownCount] = React.useState(0);
    const [history, setHistory] = React.useState([]); 
    const [isFinished, setIsFinished] = React.useState(false);
    const [exitDirection, setExitDirection] = React.useState(null);
    const [showHint, setShowHint] = React.useState(true);
    const [dragX, setDragX] = React.useState(0); 
    const [startX, setStartX] = React.useState(0); 
    const [isDragging, setIsDragging] = React.useState(false);
    const [btnFeedback, setBtnFeedback] = React.useState(null);
    const [isShuffleOn, setIsShuffleOn] = React.useState(false);

    // --- STATE CHO CẤU HÌNH HIỂN THỊ ---
    const [isConfigOpen, setIsConfigOpen] = React.useState(false);
    // 1. Khai báo ref để "tóm" lấy cái menu
    const configRef = React.useRef(null);

    // 2. Thêm logic: hễ click chuột mà không trúng menu thì đóng nó lại
    React.useEffect(() => {
        function handleClickOutside(event) {
            if (isConfigOpen && configRef.current && !configRef.current.contains(event.target)) {
                setIsConfigOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isConfigOpen]);
    const [frontOptions, setFrontOptions] = React.useState({ word: true, reading: false, hanviet: false, meaning: false });
    const [backOptions, setBackOptions] = React.useState({ word: false, reading: true, hanviet: true, meaning: true });
// --- LOGIC XỬ LÝ CHECKBOX (MỚI: TỰ ĐỘNG BỎ TÍCH MẶT KIA) ---
    const handleOptionCheck = (side, key) => {
        const isFront = side === 'front';
        
        // Tạo bản sao để sửa đổi trực tiếp
        const newFront = { ...frontOptions };
        const newBack = { ...backOptions };

        const currentOpts = isFront ? newFront : newBack;
        const otherOpts = isFront ? newBack : newFront;
        const limit = isFront ? 2 : 3; 

        // 1. Nếu đang chọn -> Bỏ chọn (Đơn giản)
        if (currentOpts[key]) {
            currentOpts[key] = false;
            setFrontOptions(newFront);
            setBackOptions(newBack);
            return;
        }

        // 2. Nếu chưa chọn -> Muốn chọn
        
        // 2a. [QUAN TRỌNG] Nếu mặt kia đang chọn trùng cái này -> Tự động bỏ chọn bên kia
        if (otherOpts[key]) {
            otherOpts[key] = false;
        }

        // 2b. Kiểm tra giới hạn số lượng (Max limit)
        const activeKeys = Object.keys(currentOpts).filter(k => currentOpts[k]);
        if (activeKeys.length >= limit) {
            // Đủ số lượng rồi -> Bỏ cái đang chọn đầu tiên đi
            const keyToRemove = activeKeys[0];
            currentOpts[keyToRemove] = false;
        }
        
        // 2c. Cuối cùng mới tích chọn cái này
        currentOpts[key] = true;

        // Cập nhật cả 2 state
        setFrontOptions(newFront);
        setBackOptions(newBack);
    };
    // --- HÀM TÍNH CỠ CHỮ ĐỘNG (ĐÃ GIẢM KÍCH THƯỚC CHO VỪA KHUNG) ---
    const getFlashcardFontSize = (text) => {
        if (!text) return 'text-3xl';
        const len = text.length;
        if (len <= 1) return "text-8xl";      // 1 chữ (Kanji): Rất to
        if (len <= 3) return "text-6xl";      // 2-3 chữ: Vừa
        if (len <= 6) return "text-5xl";      // 4-6 chữ: Hơi nhỏ lại
        if (len <= 10) return "text-4xl";     // Dài
        return "text-2xl";                    // Rất dài
    };

    const triggerConfetti = React.useCallback(() => { if (typeof confetti === 'undefined') return; const count = 200; const defaults = { origin: { y: 0.6 }, zIndex: 1500 }; function fire(particleRatio, opts) { confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) }); } fire(0.25, { spread: 26, startVelocity: 55 }); fire(0.2, { spread: 60 }); fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 }); fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 }); fire(0.1, { spread: 120, startVelocity: 45 }); }, []);
    React.useEffect(() => { if (isFinished && isOpen) { triggerConfetti(); } }, [isFinished, triggerConfetti]);
    const shuffleArray = React.useCallback((array) => { const newArr = [...array]; for (let i = newArr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newArr[i], newArr[j]] = [newArr[j], newArr[i]]; } return newArr; }, []);
    const startNewSession = React.useCallback((chars) => { setQueue(chars); setCurrentIndex(0); setIsFlipped(false); setUnknownIndices([]); setKnownCount(0); setHistory([]); setIsFinished(false); setExitDirection(null); setDragX(0); setBtnFeedback(null); }, []);
    
    // --- INIT DATA ---
    React.useEffect(() => { 
        if (isOpen && text) { 
            let chars = [];
            if (mode === 'vocab') {
                 // FIX LỖI: Lọc từ vựng phải có đủ thông tin
                 chars = text.split(/[\n;]+/)
                    .map(w => w.trim())
                    .filter(w => {
                        const info = dbData?.TUVUNG_DB?.[w];
                        return info && info.reading && info.meaning;
                    });
            } else {
                chars = Array.from(text).filter(c => c.trim()); 
            }
            chars = [...new Set(chars)];

            // FIX LỖI "KẸT STATE": Tránh crash khi mảng rỗng
            if (chars.length === 0) {
                alert("Không có từ vựng hợp lệ để ôn tập! Vui lòng bổ sung Ý nghĩa & Cách đọc.");
                onClose();
                return;
            }

            setOriginalQueue(chars); 
            const queueToLoad = isShuffleOn ? shuffleArray(chars) : chars; 
            startNewSession(queueToLoad); 
            setShowHint(true); 
        } 
    }, [isOpen, text, startNewSession, mode, dbData]);

    React.useEffect(() => { if (isOpen) { const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth; document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; document.body.style.paddingRight = `${scrollBarWidth}px`; document.body.style.touchAction = 'none'; } else { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; document.body.style.paddingRight = ''; document.body.style.touchAction = ''; } return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; document.body.style.paddingRight = ''; document.body.style.touchAction = ''; }; }, [isOpen]);
    
    const toggleFlip = React.useCallback(() => { setIsFlipped(prev => !prev); if (currentIndex === 0) setShowHint(false); }, [currentIndex]);
    const handleNext = React.useCallback((isKnown) => { 
        if (exitDirection || isFinished || queue.length === 0) return; 
        const currentChar = queue[currentIndex];
        const snapshot = (srsData && srsData[currentChar]) ? { ...srsData[currentChar] } : {};
        setIsFlipped(false); 
        if (isKnown) { setKnownCount(prev => prev + 1); } else { setUnknownIndices(prev => [...prev, currentIndex]); } 
        setHistory(prev => [...prev, { isKnown, char: currentChar, snapshot }]); 
        
        // CHỈ LƯU SRS NẾU LÀ KANJI
        if (mode !== 'vocab' && onSrsUpdate) { onSrsUpdate(currentChar, isKnown ? 1 : 0); }

        setBtnFeedback(isKnown ? 'right' : 'left'); setExitDirection(isKnown ? 'right' : 'left'); 
        setTimeout(() => { 
            setCurrentIndex((prevIndex) => { 
                if (prevIndex < queue.length - 1) { setExitDirection(null); setDragX(0); setBtnFeedback(null); return prevIndex + 1; } 
                else { setIsFinished(true); return prevIndex; } 
            }); 
        }, 175); 
    }, [currentIndex, queue, exitDirection, isFinished, srsData, mode, onSrsUpdate]);

    const handleBack = (e) => { 
        if (e) { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); } 
        if (currentIndex > 0 && history.length > 0) { 
            const lastItem = history[history.length - 1]; 
            if (lastItem.isKnown === true) { setKnownCount(prev => Math.max(0, prev - 1)); } else { setUnknownIndices(prev => prev.slice(0, -1)); } 
            if (mode !== 'vocab' && onSrsRestore && lastItem.char) { onSrsRestore(lastItem.char, lastItem.snapshot); }
            setHistory(prev => prev.slice(0, -1)); setCurrentIndex(prev => prev - 1); setIsFlipped(false); setExitDirection(null); setDragX(0); setBtnFeedback(null); 
        } 
    };

    const handleToggleShuffle = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); } const nextState = !isShuffleOn; setIsShuffleOn(nextState); setBtnFeedback('shuffle'); setTimeout(() => setBtnFeedback(null), 400); const passedPart = queue.slice(0, currentIndex); const remainingPart = queue.slice(currentIndex); if (remainingPart.length === 0) return; let newRemainingPart; if (nextState) { newRemainingPart = shuffleArray(remainingPart); } else { const counts = {}; remainingPart.forEach(c => { counts[c] = (counts[c] || 0) + 1; }); newRemainingPart = []; for (const char of originalQueue) { if (counts[char] > 0) { newRemainingPart.push(char); counts[char]--; } } } setQueue([...passedPart, ...newRemainingPart]); setIsFlipped(false); };
    
    const handleDragStart = (e) => { if (exitDirection || isFinished) return; setIsDragging(true); const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX; setStartX(clientX); };
    const handleDragMove = (e) => { if (!isDragging || exitDirection) return; const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX; setDragX(clientX - startX); };
    const dynamicBorder = () => { if (dragX > 70 || btnFeedback === 'right') return '#22c55e'; if (dragX < -70 || btnFeedback === 'left') return '#ef4444'; return 'white'; };

    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen || isFinished) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.key) {
                case ' ': case 'ArrowUp': case 'ArrowDown': e.preventDefault(); toggleFlip(); break;
                case 'ArrowLeft': e.preventDefault(); if(mode !== 'vocab' && onSrsUpdate) onSrsUpdate(queue[currentIndex], 0); handleNext(false); break;
                case 'ArrowRight': e.preventDefault(); if(mode !== 'vocab' && onSrsUpdate) onSrsUpdate(queue[currentIndex], 1); handleNext(true); break;
                case 'Escape': onClose(); break;
                default: break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isFinished, toggleFlip, handleNext, onClose, onSrsUpdate, queue, currentIndex, mode]);

    const handleDragEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (dragX > 70) { if(mode !== 'vocab' && onSrsUpdate) onSrsUpdate(queue[currentIndex], 1); handleNext(true); }
        else if (dragX < -70) { if(mode !== 'vocab' && onSrsUpdate) onSrsUpdate(queue[currentIndex], 0); handleNext(false); }
        else setDragX(0);
    };

    if (!isOpen || queue.length === 0) return null;
    const currentChar = queue[currentIndex] || ''; 
    if (!currentChar && !isFinished && isOpen) { setIsFinished(true); }
    const progressRatio = currentIndex / (queue.length - 1 || 1);

    // --- LOGIC RENDER ---
    let cardContent = { front: null, back: null };
    
    // Nút công cụ chung (Quay lại / Shuffle)
    const CardTools = (
        <div className={`absolute bottom-5 left-0 right-0 px-6 items-center z-50 ${isFlipped ? 'hidden sm:flex' : 'flex'} justify-between`}>
            <button onClick={handleBack} className={`p-2.5 bg-black/5 hover:bg-black/10 active:scale-90 rounded-full transition-all flex items-center justify-center ${currentIndex === 0 ? 'opacity-10 cursor-not-allowed' : 'text-gray-400 hover:text-gray-700'}`} disabled={currentIndex === 0}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="pointer-events-none"><path d="M9 14 4 9l5-5"/><path d="M4 9h12a5 5 0 0 1 0 10H7"/></svg>
            </button>
            <button onClick={handleToggleShuffle} className={`p-2.5 bg-black/5 hover:bg-black/10 active:scale-90 rounded-full transition-all flex items-center justify-center ${isShuffleOn ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-700'}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`pointer-events-none ${btnFeedback === 'shuffle' ? 'animate-[spin_0.4s_linear_infinite]' : ''}`}><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
            </button>
        </div>
    );

    if (mode === 'vocab') {
        // === TỪ VỰNG ===
        const vocabInfo = dbData?.TUVUNG_DB?.[currentChar] || {};
        const hanviet = vocabInfo.hanviet || currentChar.split('').map(c => dbData?.KANJI_DB?.[c]?.sound || '').filter(s => s).join(' ');

        const renderVocabFace = (options) => (
            <div className="flex-1 flex flex-col items-center justify-center w-full transform -translate-y-3 px-2">
                {/* 1. Mặt chữ: Dùng hàm getFlashcardFontSize để chỉnh size */}
                {options.word && (
                    <h3 className={`${getFlashcardFontSize(currentChar)} font-bold mb-3 uppercase tracking-tighter leading-tight text-center break-words w-full font-sans`}>
                        {currentChar}
                    </h3>
                )}
                
                <div className="space-y-2 text-center w-full">
                    {/* Hán Việt */}
                    {options.hanviet && hanviet && (
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 inline-block pb-1">{hanviet}</p>
                    )}
                    {/* Cách đọc */}
                    {options.reading && vocabInfo.reading && (
                        <p className="text-xl font-bold text-indigo-600">{vocabInfo.reading}</p>
                    )}
                    {/* Nghĩa: Tăng size chữ lên text-2xl */}
                    {options.meaning && vocabInfo.meaning && (
                        <p className="text-2xl font-bold text-gray-700 italic leading-snug px-2">{vocabInfo.meaning}</p>
                    )}
                </div>
            </div>
        );

        // Đã xóa dòng "Chạm để lật" trùng lặp, chỉ giữ 1 cái duy nhất ở dưới
        cardContent.front = <>{renderVocabFace(frontOptions)} {currentIndex === 0 && showHint && (<p className="absolute bottom-14 text-indigo-400 text-[7px] font-black uppercase tracking-[0.4em] animate-pulse">Chạm để lật</p>)} {CardTools}</>;
        cardContent.back = <>{renderVocabFace(backOptions)}</>;

    } else {
        // === KANJI ===
        const info = dbData?.KANJI_DB?.[currentChar] || dbData?.ALPHABETS?.hiragana?.[currentChar] || dbData?.ALPHABETS?.katakana?.[currentChar] || {};
        cardContent.front = (
            <>
                 <span className="text-8xl font-['Klee_One'] text-gray-800 transform -translate-y-5">{currentChar}</span>
                 {currentIndex === 0 && showHint && (<p className="absolute bottom-14 text-indigo-400 text-[7px] font-black uppercase tracking-[0.4em] animate-pulse">Chạm để lật</p>)}
                 {CardTools}
            </>
        );
        cardContent.back = (
             <div className="flex-1 flex flex-col items-center justify-center w-full transform -translate-y-3">
                <h3 className="text-3xl font-black mb-2 uppercase tracking-tighter leading-tight">{info.sound || '---'}</h3>
                <p className="text-base opacity-90 font-medium italic leading-snug px-2">{info.meaning || ''}</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-gray-900/95 backdrop-blur-xl animate-in fade-in duration-200 select-none touch-none cursor-pointer" style={{ touchAction: 'none' }} onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-sm flex flex-col items-center relative cursor-default" onClick={(e) => e.stopPropagation()}>
                
                {!isFinished ? (
                    <>
                        {/* --- CARD --- */}
                        <div className={`relative transition-all duration-300 ease-in-out ${exitDirection === 'left' ? '-translate-x-16 -rotate-3' : exitDirection === 'right' ? 'translate-x-16 rotate-3' : ''}`} style={{ transform: !exitDirection && dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX * 0.02}deg)` : '', transition: isDragging ? 'none' : 'all 0.25s ease-out' }}>
                            <div onClick={() => { if (Math.abs(dragX) < 5) toggleFlip(); }} onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd} onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd} className={`relative w-64 h-80 cursor-pointer transition-all duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                                {/* FRONT */}
                                <div className="absolute inset-0 bg-white rounded-[2rem] shadow-2xl flex flex-col items-center justify-center border-4 [backface-visibility:hidden] overflow-hidden p-4" style={{ borderColor: dynamicBorder() }}>
                                    {cardContent.front}
                                </div>
                                {/* BACK */}
                                <div className="absolute inset-0 bg-indigo-50 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] border-4 overflow-hidden text-center" style={{ borderColor: dynamicBorder() }}>
                                     {cardContent.back}
                                </div>
                            </div>
                        </div>
                        
                        {/* --- THANH TIẾN TRÌNH + NÚT CÀI ĐẶT --- */}
                        <div className="w-72 mt-8 mb-6 flex items-center gap-3"> {/* Tăng width lên w-72 để rộng hơn */}
                            <div className="flex-1 relative h-6 flex items-center">
                                <div className="w-full h-1 bg-white/10 rounded-full relative overflow-hidden"><div className="absolute top-0 left-0 h-full bg-sky-400 transition-all duration-300 ease-out" style={{ width: `${progressRatio * 100}%` }} /></div>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-full h-1 pointer-events-none"><div className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-9 rounded-md flex items-center justify-center bg-white shadow-sm z-0"><span className="text-[10px] font-black text-black leading-none">{queue.length}</span></div></div>
                                <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 pointer-events-none"><div className="absolute top-1/2 -translate-y-1/2 h-7 w-9 bg-sky-400 rounded-md flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.8)] transition-all duration-300 ease-out z-10" style={{ left: `calc(${progressRatio * 100}% - ${progressRatio * 36}px)` }}><span className="text-[10px] font-black text-white leading-none">{currentIndex + 1}</span></div></div>
                            </div>

                            {/* Nút Cài Đặt (Nằm bên phải thanh tiến độ) */}
                            {mode === 'vocab' && (
                                <div className="relative" ref={configRef}>
                                    <button 
                                        onClick={() => setIsConfigOpen(!isConfigOpen)}
                                        className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                    </button>
                                {/* MENU POPUP CẤU HÌNH (ĐÃ BỎ DISABLED) */}
                                    {isConfigOpen && (
                                        <div className="absolute bottom-full right-0 mb-3 bg-white rounded-xl shadow-2xl p-3 w-56 animate-in fade-in zoom-in-95 z-[60] text-gray-800 border border-gray-100">
                                            <div className="mb-3 border-b border-gray-100 pb-2">
                                                <p className="text-[10px] font-black text-indigo-600 mb-1.5 uppercase flex justify-between">
                                                    <span>Mặt trước (Câu hỏi)</span>
                                     
                                                </p>
                                                <div className="space-y-1">
                                                    {/* Chỉ hiện: Mặt chữ, Cách đọc, Ý nghĩa */}
                                                    {['word', 'reading', 'meaning'].map(opt => (
                                                        <label key={`f-${opt}`} className="flex items-center gap-2 text-[11px] p-1.5 rounded transition-all cursor-pointer hover:bg-indigo-50">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={frontOptions[opt]} 
                                                                onChange={() => handleOptionCheck('front', opt)} 
                                                                className="accent-indigo-600 w-3.5 h-3.5"
                                                            />
                                                            <span className="font-medium">
                                                                {opt === 'word' ? 'Mặt chữ' : opt === 'reading' ? 'Cách đọc' : 'Ý nghĩa'}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-600 mb-1.5 uppercase flex justify-between">
                                                    <span>Mặt sau (Đáp án)</span>
            
                                                </p>
                                                <div className="space-y-1">
                                                    {/* Hiện đủ 4 cái: Mặt chữ, Cách đọc, Hán Việt, Ý nghĩa */}
                                                    {['word', 'reading', 'hanviet', 'meaning'].map(opt => (
                                                        <label key={`b-${opt}`} className="flex items-center gap-2 text-[11px] p-1.5 rounded transition-all cursor-pointer hover:bg-indigo-50">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={backOptions[opt]} 
                                                                onChange={() => handleOptionCheck('back', opt)} 
                                                                className="accent-indigo-600 w-3.5 h-3.5"
                                                            />
                                                            <span className="font-medium">
                                                                {opt === 'word' ? 'Mặt chữ' : opt === 'reading' ? 'Cách đọc' : opt === 'hanviet' ? 'Hán Việt' : 'Ý nghĩa'}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* --- NÚT ĐIỀU HƯỚNG --- */}
                        <div className="flex gap-3 w-full px-8">
                            <button onClick={() => { if(mode !== 'vocab' && onSrsUpdate) onSrsUpdate(currentChar, 0); handleNext(false); }} className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 hover:text-red-600 active:bg-red-500 text-red-500 active:text-white border border-red-500/20 rounded-xl font-black text-[10px] transition-all flex items-center justify-center gap-2 uppercase">
                                ĐANG HỌC <span className="bg-red-600 text-white min-w-[28px] h-6 px-2 rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm">{unknownIndices.length}</span>
                            </button>
                            <button onClick={() => { if(mode !== 'vocab' && onSrsUpdate) onSrsUpdate(currentChar, 1); handleNext(true); }} className="flex-1 py-3 bg-green-500/10 hover:bg-green-500/20 hover:text-green-600 active:bg-green-500 text-green-500 active:text-white border border-green-500/20 rounded-xl font-black text-[10px] transition-all flex items-center justify-center gap-2 uppercase">
                                ĐÃ BIẾT <span className="bg-green-600 text-white min-w-[28px] h-6 px-2 rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm">{knownCount}</span>
                            </button>
                        </div>

                        <button onClick={onClose} className="mt-8 text-white/40 hover:text-red-500 transition-all text-[13px] sm:text-[11px] font-black uppercase tracking-[0.2em] py-2 px-4 active:scale-95">Đóng thẻ</button>
                    </>
                ) : (
                    // MÀN HÌNH HOÀN THÀNH
                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-[280px] text-center shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95">
                        <div className="text-5xl mb-4 animate-bounce cursor-pointer hover:scale-125 transition-transform" onClick={triggerConfetti} title="Bấm để bắn pháo hoa!">🎉</div>
                        <h3 className="text-lg font-black text-gray-800 mb-1 uppercase">Hoàn thành</h3>
                        <p className="text-gray-400 mb-6 text-[11px] font-medium italic">Bạn đã học được {knownCount}/{queue.length} chữ.</p>
                        <div className="space-y-2">
                            {unknownIndices.length > 0 && (<button onClick={() => startNewSession(isShuffleOn ? shuffleArray(unknownIndices.map(idx => queue[idx])) : unknownIndices.map(idx => queue[idx]))} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] shadow-lg active:scale-95 transition-colors">ÔN LẠI {unknownIndices.length} THẺ ĐANG HỌC</button>)}
                            <button onClick={() => startNewSession(isShuffleOn ? shuffleArray(originalQueue) : originalQueue)} className="w-full py-3.5 bg-blue-50 border-2 border-blue-100 text-blue-500 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 rounded-xl font-black text-[11px] transition-all active:scale-95">HỌC LẠI TỪ ĐẦU</button>
                            <button onClick={onClose} className="w-full py-3.5 bg-white border-2 border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-600 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95">THOÁT</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENT POPUP HOẠT HỌA (Đã chỉnh con trỏ chuột) ---
const KanjiAnimationModal = ({ char, paths, fullSvg, dbData, isOpen, onClose }) => {
const [key, setKey] = useState(0); 
const [strokeNumbers, setStrokeNumbers] = useState([]); 
const [speedConfig, setSpeedConfig] = useState({ duration: 3, delay: 0.6 });
const initialDelay = 0.4;
const [activeSpeed, setActiveSpeed] = useState('normal'); 

// Logic khóa cuộn
useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
}, [isOpen]);

// Logic lấy số thứ tự
useEffect(() => {
    if (fullSvg) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(fullSvg, "image/svg+xml");
        const textElements = Array.from(doc.querySelectorAll('text'));
        const numbers = textElements.map(t => ({
            value: t.textContent,
            transform: t.getAttribute('transform')
        }));
        setStrokeNumbers(numbers);
    }
}, [fullSvg]);

const handleReplay = (mode) => {
    let newConfig = { duration: 3, delay: 0.6 };
    if (mode === 'slow') newConfig = { duration: 4, delay: 1 };      
    if (mode === 'fast') newConfig = { duration: 1.5, delay: 0.25 };  
    setSpeedConfig(newConfig);
    setActiveSpeed(mode);
    setKey(prev => prev + 1); 
};

if (!isOpen) return null;

// Logic lấy dữ liệu thông minh
let info = {};
if (dbData?.KANJI_DB?.[char]) info = dbData.KANJI_DB[char];
else if (dbData?.ALPHABETS?.hiragana?.[char]) info = dbData.ALPHABETS.hiragana[char];
else if (dbData?.ALPHABETS?.katakana?.[char]) info = dbData.ALPHABETS.katakana[char];

return (
    <div 
        
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
        onClick={onClose} 
    >
        <div 
            
            className="bg-white rounded-2xl shadow-2xl p-5 w-[90%] max-w-sm flex flex-col items-center relative animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()} 
        >
            <button 
                onClick={onClose}
                className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-full transition-colors z-10"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div className="flex items-center justify-center gap-5 mb-3 mt-2 w-full px-2">
                <h3 className="text-5xl font-black text-indigo-600 font-['Klee_One'] leading-none">
                    {char}
                </h3>
                <div className="flex flex-col items-start justify-center h-full pt-1">
                    {info.sound ? (
                        <>
                            <span className="text-xl font-black text-gray-800 uppercase font-sans tracking-wide leading-tight mb-0.5">
                                {info.sound}
                            </span>
                            {info.meaning && (
                                <span className="text-xs text-gray-500 font-medium font-sans italic leading-tight text-left">
                                    {info.meaning}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-xs text-gray-400 font-sans">---</span>
                    )}
                </div>
            </div>

            <div key={key} className="w-60 h-40 bg-white border border-indigo-50 rounded-xl relative mb-4 shadow-inner flex-shrink-0 flex items-center justify-center">
               

                <svg viewBox="0 0 109 109" className="h-full w-auto p-2">
                    {strokeNumbers.map((num, idx) => (
                        <text 
                            key={`num-${idx}`} 
                            transform={num.transform} 
                            className="stroke-number"
                            style={{ animationDelay: `${initialDelay + (idx * speedConfig.delay)}s` }} 
                        >
                            {num.value}
                        </text>
                    ))}
                    {paths.map((d, index) => (
                        <path 
                            key={`path-${index}`}
                            d={d} 
                            className="stroke-anim-path"
                            style={{ 
                                animationDuration: `${speedConfig.duration}s`, 
                                animationDelay: `${initialDelay + (index * speedConfig.delay)}s` 
                            }} 
                        />
                    ))}
                </svg>
            </div>

            <div className="flex justify-center gap-2 w-full px-2">
                <button 
                    onClick={() => handleReplay('slow')}
                    title="Tua chậm"
                    className={`py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 ${activeSpeed === 'slow' ? 'bg-indigo-100 text-indigo-700 font-bold ring-1 ring-indigo-300' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200 shadow-sm'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                    <span className="text-[10px] font-bold uppercase">Chậm</span>
                </button>

                <button 
                    onClick={() => handleReplay('normal')}
                    title="Vẽ lại"
                    className={`py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 ${activeSpeed === 'normal' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                    <span className="text-[10px] font-bold uppercase">Vẽ lại</span>
                </button>

                <button 
                    onClick={() => handleReplay('fast')}
                    title="Tua nhanh"
                    className={`py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 ${activeSpeed === 'fast' ? 'bg-indigo-100 text-indigo-700 font-bold ring-1 ring-indigo-300' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200 shadow-sm'}`}
                >
                    <span className="text-[10px] font-bold uppercase">Nhanh</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                </button>
            </div>
        </div>
    </div>
);
};


const LearnGameModal = ({ isOpen, onClose, text, dbData, onSwitchToFlashcard, mode }) => {
    // Helper cũ cho Kanji (GIỮ NGUYÊN)
    const getCharInfo = (c) => {
        if (!dbData) return null;
        if (dbData.ALPHABETS?.hiragana?.[c]) return { ...dbData.ALPHABETS.hiragana[c], type: 'hiragana' };
        if (dbData.ALPHABETS?.katakana?.[c]) return { ...dbData.ALPHABETS.katakana[c], type: 'katakana' };
        if (dbData.KANJI_DB?.[c]) return { ...dbData.KANJI_DB[c], type: 'kanji' };
        return null;
    };

    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [gameState, setGameState] = useState('loading'); 

    const [selectedIdx, setSelectedIdx] = React.useState(null);
    const [isChecking, setIsChecking] = React.useState(false);

    // State Tiến độ
    const [totalKanji, setTotalKanji] = useState(0);        
    const [finishedCount, setFinishedCount] = useState(0); 

    // State xử lý lỗi & phạt
    const [wrongItem, setWrongItem] = useState(null); 
    const [penaltyInput, setPenaltyInput] = useState(''); 
    const [penaltyFeedback, setPenaltyFeedback] = useState(null); 
    
    // State ghép thẻ
    const [matchCards, setMatchCards] = useState([]);
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [matchedIds, setMatchedIds] = useState([]);
    const [wrongPairIds, setWrongPairIds] = useState([]);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setGameState('loading');
            setQueue([]);
            setFinishedCount(0);
            setWrongItem(null);
            setSelectedIdx(null);
            setIsChecking(false);
        }
    }, [isOpen]);

    const shuffleArray = (array) => {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    };

   // --- HÀM TÍNH CỠ CHỮ ĐỘNG (ĐÃ NÂNG CẤP) ---
    const getDynamicFontSize = (text, type = 'normal') => {
        if (!text) return '';
        const len = text.length;

        // 1. DÀNH CHO TIÊU ĐỀ LỚN (Phần câu hỏi)
        if (type === 'title') {
            if (len > 15) return 'text-xl leading-tight break-words';      // Cực dài
             if (len > 8) return 'text-2xl leading-tight break-words';      // Dài
             if (len > 5) return 'text-4xl leading-tight break-words';      // Trung bình (6-8 chữ)
             if (len > 3) return 'text-5xl whitespace-nowrap';              // 4-5 chữ (Sửa cho "America")
             return 'text-6xl';                              // Mặc định: Cỡ đại
        }

        // 2. DÀNH CHO NÚT BẤM & THẺ GHÉP (Button & Match Card)
       if (type === 'button') {
            if (len > 40) return 'text-[9px] leading-tight px-1 break-words'; 
            if (len > 20) return 'text-[10px] leading-tight px-1 break-words'; 
            if (len > 12) return 'text-xs leading-snug break-words'; 
            if (len > 8)  return 'text-xs whitespace-nowrap'; // Ép 1 dòng
            return 'text-sm font-bold whitespace-nowrap';     // Ngắn
        }
        return '';
    };

   // 1. KHỞI TẠO DỮ LIỆU (PHÂN TÁCH LOGIC TỪ VỰNG VÀ KANJI)
    // 1. KHỞI TẠO DỮ LIỆU (ĐÃ SỬA: LỌC KỸ DỮ LIỆU ĐẦU VÀO)
    const initGame = () => {
        if (!text || !dbData) return;
   

        let validItems = [];
        const isVocabMode = mode === 'vocab';

       if (isVocabMode) {
        // --- LOGIC TỪ VỰNG: SỬA ĐOẠN NÀY ---
        // Tách dòng -> Trim -> Kiểm tra kỹ xem từ đó có trong TUVUNG_DB không
        validItems = Array.from(new Set(
            text.split(/[\n;]+/)
                .map(w => w.trim())
                // ĐIỀU KIỆN QUAN TRỌNG:
                // 1. Không được rỗng
                // 2. dbData phải tồn tại
                // 3. TUVUNG_DB phải tồn tại
                // 4. Từ 'w' phải có Key nằm trong TUVUNG_DB
                .filter(w => w.length > 0 && dbData?.TUVUNG_DB && dbData.TUVUNG_DB[w]) 
        ));
    } else {
        // --- LOGIC KANJI (Giữ nguyên hoặc thêm kiểm tra chặt chẽ) ---
        validItems = Array.from(new Set(
            text.split('')
                .filter(c => getCharInfo(c)) // Hàm getCharInfo đã kiểm tra DB rồi
        ));
    }

        // Nếu lọc xong mà không còn từ nào (do nhập linh tinh hoặc chưa có data)
        if (validItems.length === 0) { 
            alert("Không có từ nào hợp lệ hoặc có trong dữ liệu để học!"); 
            onClose(); 
            return; 
        }

        // Trộn ngẫu nhiên
        validItems = shuffleArray(validItems); 

        setTotalKanji(validItems.length);
        
        let newQueue = [];
        const CHUNK_SIZE = 6; 

        for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
            const chunk = validItems.slice(i, i + CHUNK_SIZE);
            // Quiz 1
            chunk.forEach(item => newQueue.push({ type: 'quiz_sound', item }));
            
            // Match
            if (chunk.length >= 2) newQueue.push({ type: 'match', items: chunk });
            
            // Quiz 2
            chunk.forEach(item => newQueue.push({ type: 'quiz_reverse', item })); 
        }

        setQueue(newQueue); 
        setCurrentIndex(0);
        
    

        setPenaltyInput(''); 
        setMatchedIds([]);
        setWrongPairIds([]);
    if (newQueue.length > 0) {
            setGameState(newQueue[0].type);
        } else {
            setGameState('finished');
        }
    };


    useEffect(() => {
        if (isOpen) initGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, text, dbData, mode]);
    
    // 2. SINH DỮ LIỆU CÂU HỎI (QUIZ DATA)
    const currentQuizData = useMemo(() => {
        const currentItem = queue[currentIndex];
        if (!currentItem || !['quiz_sound', 'quiz_reverse'].includes(currentItem.type)) return null;

        const target = currentItem.item; // Là char (Kanji) hoặc word (Vocab)
        const isVocabMode = mode === 'vocab';
        let targetInfo = null;

        // --- LẤY THÔNG TIN TARGET ---
        if (isVocabMode) {
            targetInfo = dbData.TUVUNG_DB[target];
            if (!targetInfo) return null;
        } else {
            targetInfo = getCharInfo(target);
            if (!targetInfo) return null;
        }

       let distractorPool = [];
        if (isVocabMode) {
            // Lấy từ danh sách đang học (input)
            const allInputWords = text.split('\n').map(w => w.trim()).filter(w => w);
            
            // LỌC KỸ: Chỉ lấy những từ CÓ trong DB và KHÁC từ hiện tại
            const validPool = allInputWords.filter(w => w !== target && dbData?.TUVUNG_DB?.[w]);

            if (validPool.length >= 3) {
                 distractorPool = validPool;
            } else {
                 // Nếu ít quá thì lấy đại trong DB (nhưng phải đảm bảo key tồn tại)
                 // Object.keys lấy tất cả key, nên chắc chắn tồn tại, chỉ cần filter khác target
                 if (dbData?.TUVUNG_DB) {
                    distractorPool = Object.keys(dbData.TUVUNG_DB).filter(w => w !== target);
                 }
            }
        } else {
            // Logic Kanji cũ
            const userChars = Array.from(new Set(text.split('').filter(c => getCharInfo(c))));
            if (userChars.length >= 4) {
                distractorPool = userChars.filter(c => c !== target);
            } else {
                 // Fallback logic cũ... (lược bớt cho gọn, giữ nguyên logic cũ của bạn ở đây)
                 distractorPool = Object.keys(dbData.KANJI_DB).filter(c => c !== target);
            }
        }
        
        // Chọn 3 đáp án sai
        const distractors = shuffleArray(distractorPool).slice(0, 3);

        // --- TẠO OPTIONS & QUESTION DISPLAY ---
        let options = [];
        let questionDisplay = {};

        if (isVocabMode) {
            // === CHẾ ĐỘ TỪ VỰNG ===
            
            if (currentItem.type === 'quiz_sound') {
                // QUIZ 1: Hiện Mặt Chữ (+ Cách đọc) --> Chọn Nghĩa
                const readingDisplay = targetInfo.reading && targetInfo.reading !== target ? targetInfo.reading : '';
                questionDisplay = {
                    main: target,
                    sub: readingDisplay, // Hiện cách đọc ở dưới
                    isKanji: false // Để dùng font thường
                };
                
                // Đáp án là NGHĨA
                options = [
                    { label: targetInfo.meaning, correct: true },
                    ...distractors.map(d => ({ label: dbData.TUVUNG_DB[d]?.meaning || '---', correct: false }))
                ];

            } else {
                // QUIZ 2 (Reverse): Hiện Nghĩa --> Chọn Mặt Chữ
                questionDisplay = {
                    main: targetInfo.meaning,
                    sub: null,
                    isKanji: false
                };

                // Đáp án là MẶT CHỮ
                options = [
                    { label: target, correct: true },
                    ...distractors.map(d => ({ label: d, correct: false }))
                ];
            }

        } else {
            // === CHẾ ĐỘ KANJI (GIỮ NGUYÊN) ===
            if (currentItem.type === 'quiz_reverse') {
                 // Chọn mặt chữ
                 options = [
                    { label: target, correct: true, isKanji: true },
                    ...distractors.map(d => ({ label: d, correct: false, isKanji: true }))
                ];
                questionDisplay = { main: targetInfo.sound, sub: null, isKanji: false };
            } else {
                // Chọn âm đọc
                options = [
                    { label: targetInfo.sound, correct: true, isKanji: false },
                    ...distractors.map(d => ({ label: getCharInfo(d)?.sound || '---', correct: false, isKanji: false }))
                ];
                questionDisplay = { main: target, sub: targetInfo.meaning, isKanji: true };
            }
        }

        options = shuffleArray(options);
        
        // Trả về dữ liệu đã chuẩn hóa để render
        return { target, targetInfo, options, questionDisplay, quizType: currentItem.type };

    }, [queue, currentIndex, dbData, text, mode]); // Thêm mode
    
      
// 3. SINH DỮ LIỆU MATCH (GHÉP THẺ) - ĐÃ SỬA LỖI LẶP CODE
    useEffect(() => {
        // Chỉ chạy khi game state là match
        if (queue[currentIndex]?.type === 'match') {
            const items = queue[currentIndex].items;
            let cards = [];
            const isVocabMode = mode === 'vocab';

            items.forEach((item, idx) => {
                if (isVocabMode) {
                    // === LOGIC TỪ VỰNG: Ghép [Mặt chữ] <-> [Nghĩa] ===
                    // Kiểm tra dbData.TUVUNG_DB tồn tại trước khi truy cập
                    const info = dbData.TUVUNG_DB ? dbData.TUVUNG_DB[item] : null;
                    
                    if (info) {
                        // Thẻ 1: Mặt chữ
                        cards.push({ id: `w-${idx}`, content: item, type: 'word', matchId: idx });
                        
                        // Thẻ 2: Ưu tiên Nghĩa -> Cách đọc -> Fallback
                        const content2 = info.meaning || info.reading || '...';
                        cards.push({ id: `m-${idx}`, content: content2, type: 'meaning', matchId: idx });
                    }
                } else {
                    // === LOGIC KANJI: Ghép [Chữ Hán] <-> [Âm Hán] ===
                    const info = getCharInfo(item);
                    if (info) {
                        // Thẻ 1: Chữ Kanji
                        cards.push({ id: `k-${idx}`, content: item, type: 'kanji', matchId: idx });
                        // Thẻ 2: Âm Hán Việt
                        cards.push({ id: `m-${idx}`, content: info.sound, type: 'meaning', matchId: idx });
                    }
                }
            });

            // Trộn ngẫu nhiên thẻ sau khi sinh xong
            cards.sort(() => Math.random() - 0.5);
            
            // Cập nhật State
            setMatchCards(cards);
            setMatchedIds([]);
            setSelectedCardId(null);
            setWrongPairIds([]);
        }
    }, [queue, currentIndex, dbData, mode]);

    
                   
    const handleAnswer = (isCorrect, itemData) => {
        if (isCorrect) {
            if (itemData.quizType === 'quiz_reverse') {
                setFinishedCount(prev => prev + 1);
            }
            goNext();
        } else {
            setWrongItem(itemData); 
            setGameState('penalty');
            const currentQ = queue[currentIndex];
            const nextQ = [...queue];
            const insertIndex = Math.min(currentIndex + 5, nextQ.length);
            nextQ.splice(insertIndex, 0, currentQ);
            setQueue(nextQ);
        }
    };

 const checkPenalty = () => {
        if (!wrongItem) return;
        const inputClean = removeAccents(penaltyInput.trim().toLowerCase());
        
        let isCorrect = false;

        if (mode === 'vocab') {
            // TỪ VỰNG: Chấp nhận gõ đúng MẶT CHỮ hoặc CÁCH ĐỌC
            const targetWord = removeAccents(wrongItem.target.toLowerCase());
            const targetReading = wrongItem.targetInfo.reading ? removeAccents(wrongItem.targetInfo.reading.toLowerCase()) : '';
            
            // Đúng nếu khớp 1 trong 2
            isCorrect = (inputClean === targetWord) || (inputClean === targetReading);
        } else {
            // KANJI: Phải gõ đúng Âm Hán Việt (Giữ nguyên)
            const targetClean = removeAccents(wrongItem.targetInfo.sound.toLowerCase());
            isCorrect = inputClean === targetClean;
        }

        if (isCorrect) {
            setPenaltyFeedback('correct'); 
            setTimeout(() => { 
                setPenaltyFeedback(null); 
                setPenaltyInput(''); 
                goNext(); 
            }, 800);
        } else { 
            setPenaltyFeedback('incorrect'); 
            setTimeout(() => setPenaltyFeedback(null), 500); 
        }
    };
    
    const handleCardClick = (card) => {
        if (matchedIds.includes(card.id) || wrongPairIds.length > 0) return;
        
        if (selectedCardId === null) {
            setSelectedCardId(card.id);
        } else {
            if (selectedCardId === card.id) { setSelectedCardId(null); return; }
            
            const first = matchCards.find(c => c.id === selectedCardId);
            if (first.matchId === card.matchId) {
                setMatchedIds(p => [...p, first.id, card.id]); 
                setSelectedCardId(null);
                if (matchedIds.length + 2 === matchCards.length) setTimeout(() => goNext(), 500);
            } else {
                setWrongPairIds([first.id, card.id]);
                setTimeout(() => {
                    setWrongPairIds([]); 
                    setSelectedCardId(null); 
                }, 500); 
            }
        }
    };

    const goNext = () => {
        if (currentIndex < queue.length - 1) { 
            const next = currentIndex + 1; 
            setCurrentIndex(next); 
            setGameState(queue[next].type); 
        } else { 
            setGameState('finished'); 
        }
    };

    const triggerConfetti = React.useCallback(() => { if (typeof confetti === 'undefined') return; const count = 200; const defaults = { origin: { y: 0.6 }, zIndex: 1500 }; function fire(particleRatio, opts) { confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) }); } fire(0.25, { spread: 26, startVelocity: 55 }); fire(0.2, { spread: 60 }); fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 }); fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 }); fire(0.1, { spread: 120, startVelocity: 45 }); }, []);
    useEffect(() => { if (gameState === 'finished' && isOpen) { triggerConfetti(); } }, [gameState, isOpen, triggerConfetti]);

  const handleRestart = () => {
    setFinishedCount(0);
    setWrongItem(null);
    setPenaltyInput('');
    setMatchedIds([]);
    setWrongPairIds([]);
    setSelectedIdx(null);
    setIsChecking(false);
    initGame(); // Gọi lại hàm init
};

    if (!isOpen) return null;
   

    const visualPercent = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;

    return (
        <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-xl p-4 animate-in fade-in select-none">
            
            {/* --- CHỜ 1 FRAME RỒI MỚI HIỂN THỊ ĐỂ NỀN ĐEN KHÔNG BỊ GIẬT --- */}
            {gameState === 'loading' ? null : gameState === 'finished' ? (
                <div className="bg-white rounded-[2rem] p-8 w-full max-w-[280px] text-center shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95">
                    <div className="text-5xl mb-4 animate-bounce cursor-pointer hover:scale-125 transition-transform" onClick={triggerConfetti}>🎉</div>
                    <h3 className="text-lg font-black text-gray-800 mb-1 uppercase">XUẤT SẮC!</h3>
                    <p className="text-gray-400 mb-6 text-[11px] font-medium italic">Bạn đã hoàn thành bài học.</p>
                    <div className="space-y-2">
                        <button onClick={onSwitchToFlashcard} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] shadow-lg active:scale-95 transition-colors">
                            ÔN FLASHCARD
                        </button>
                        <button onClick={handleRestart} className="w-full py-3.5 bg-blue-50 border-2 border-blue-100 text-blue-500 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 rounded-xl font-black text-[11px] transition-all active:scale-95">
                            HỌC LẠI TỪ ĐẦU
                        </button>
                        <button onClick={onClose} className="w-full py-3.5 bg-white border-2 border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-600 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95">
                            THOÁT
                        </button>
                    </div>
                </div>
            ) : (
                /* --- TRƯỜNG HỢP 2: ĐANG CHƠI GAME --- */
                <div className="w-full max-w-sm flex flex-col items-center h-full max-h-[80vh]">
                    
                    {/* THANH TIẾN ĐỘ */}
                    <div className="w-full flex items-center gap-3 mb-6 px-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-500 ease-out" style={{ width: `${visualPercent}%` }}></div>
                        </div>
                        <div className="text-white/40 text-[10px] font-bold min-w-[30px] text-center">
                            {finishedCount}/{totalKanji}
                        </div>
                        <button onClick={onClose} className="text-white/40 md:hover:text-red-500 transition-all font-black text-3xl leading-none p-3 -mr-3 active:scale-110 flex items-center justify-center">
                            ✕
                        </button>
                    </div>

                    {/* NỘI DUNG CHÍNH */}
                    <div className="flex-1 w-full flex flex-col items-center justify-center relative">

                        {/* --- DẠNG BÀI: QUIZ (Trắc nghiệm) --- */}
                        {(gameState === 'quiz_sound' || gameState === 'quiz_reverse') && currentQuizData && (
                            <>
                                {/* HÌNH ẢNH CÂU HỎI */}
                                <div className="bg-white rounded-[2rem] w-64 h-64 flex flex-col items-center justify-center shadow-2xl mb-8 relative animate-in zoom-in-95 duration-300">
                                     
                                    {/* Text Chính */}
<div className={`text-center mb-2 text-gray-800 flex items-center justify-center h-full w-full px-4
    ${currentQuizData.questionDisplay.isKanji 
        ? "text-8xl font-['Klee_One'] -translate-y-4" 
        : getDynamicFontSize(currentQuizData.questionDisplay.main, 'title') + " font-black uppercase tracking-wider break-words"
    }`}>
   {currentQuizData.questionDisplay.main}
</div>

                                    {/* Text Phụ (Nghĩa hoặc Cách đọc) */}
                                    {currentQuizData.questionDisplay.sub && (
                                        <div className="absolute bottom-6 px-4 py-1.5 bg-gray-50 text-gray-500 text-sm font-bold uppercase rounded-full border border-gray-100 max-w-[90%] truncate">
                                            {currentQuizData.questionDisplay.sub}
                                        </div>
                                    )}
                                </div>

                                {/* 4 NÚT ĐÁP ÁN */}
                                <div className="grid grid-cols-2 gap-3 w-full">
                                    {currentQuizData.options.map((opt, i) => {
                                        const isSelected = selectedIdx === i;
                                        
                                        let statusClass = "bg-white/10 border-white/10 text-white"; 
                                        if (isSelected) {
                                            statusClass = opt.correct 
                                                ? "bg-green-500 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.6)]" 
                                                : "bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]";   
                                        }

                                        return (
                                            <button 
                                                key={i} 
                                                disabled={isChecking}
                                                onClick={(e) => {
                                                    e.currentTarget.blur(); 
                                                    if (isChecking) return;
                                                    setSelectedIdx(i);
                                                    setIsChecking(true);
                                                    setTimeout(() => {
                                                        handleAnswer(opt.correct, currentQuizData);
                                                        setSelectedIdx(null);
                                                        setIsChecking(false);
                                                    }, 350);
                                                }} 
                                                className={`h-14 w-full px-1 border rounded-xl font-bold flex items-center justify-center text-center shadow-lg backdrop-blur-sm transition-all duration-200 active:scale-95
        ${statusClass}
        ${!isChecking ? 'md:hover:bg-white/20' : ''} 
        ${opt.isKanji 
            ? "text-3xl font-['Klee_One']"  
            : getDynamicFontSize(opt.label, 'button') + " font-sans uppercase" 
        }`}
>
    {opt.label}
</button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* --- DẠNG BÀI: PENALTY (Phạt viết lại) --- */}
                        {gameState === 'penalty' && wrongItem && (
                             <div className="bg-white rounded-[2rem] w-full max-w-[300px] p-6 flex flex-col items-center justify-center shadow-2xl animate-in slide-in-from-right duration-300">
                                <h3 className="text-sm font-black text-gray-400 uppercase mb-2">Viết lại để ghi nhớ</h3>
                                
                                {/* Chữ to chính giữa */}
                                <div className={`mb-2 text-gray-800 ${mode === 'kanji' ? "text-7xl font-['Klee_One']" : "text-4xl font-bold font-sans break-words text-center"}`}>
                                    {wrongItem.target}
                                </div>
                                
                                {/* Thông tin phụ (Màu xanh) */}
                                <p className="text-blue-600 font-black text-lg uppercase tracking-widest mb-1">
                                    {mode === 'kanji' ? wrongItem.targetInfo.sound : (wrongItem.targetInfo.reading || '')}
                                </p>
                                
                                {/* Nghĩa */}
                                {wrongItem.targetInfo.meaning && (
                                    <p className="text-xs text-gray-400 font-medium italic mb-6">({wrongItem.targetInfo.meaning})</p>
                                )}

                                <input 
                                    type="text" 
                                    autoFocus 
                                    value={penaltyInput} 
                                    onChange={(e) => setPenaltyInput(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && checkPenalty()} 
                                    placeholder={mode === 'kanji' ? "Nhập âm Hán Việt..." : "Nhập lại từ vựng..."}
                                    className={`w-full p-3 text-center text-base font-bold border-2 rounded-xl outline-none transition-all ${penaltyFeedback === 'incorrect' ? 'border-red-500 bg-red-50' : penaltyFeedback === 'correct' ? 'border-green-500 bg-green-50' : 'border-gray-200 focus:border-blue-500'}`} 
                                />
                                <button onClick={checkPenalty} className="w-full mt-3 py-3 bg-gray-900 text-white font-bold rounded-xl active:scale-95 transition-all uppercase text-[10px] tracking-widest">
                                    KIỂM TRA
                                </button>
                            </div>
                        )}

                        {/* --- DẠNG BÀI: MATCHING (Ghép thẻ) --- */}
                        {gameState === 'match' && (
                            <div className="w-full flex flex-col items-center justify-center">
                                <div className="border-2 border-dashed border-white/20 rounded-2xl p-4 w-full">
                                    <div className="grid grid-cols-3 gap-2 w-full">
                                        {matchCards.map((card) => {
                                            const isMatched = matchedIds.includes(card.id);
                                            const isSelected = selectedCardId === card.id;
                                            const isWrong = wrongPairIds.includes(card.id);

                                            return (
                                               <button 
    key={card.id} 
    onClick={() => handleCardClick(card)} 
    disabled={isMatched} 
    className={`h-20 rounded-xl font-bold flex items-center justify-center transition-all duration-200 p-1 shadow-lg
        ${isMatched ? 'opacity-0 scale-50 pointer-events-none' : 
          isWrong ? 'bg-red-500 text-white animate-shake' : 
          isSelected ? 'bg-blue-500 text-white scale-105 ring-2 ring-white/50' : 
          'bg-white text-gray-800 hover:bg-gray-50 active:scale-95'}
        
        ${card.type === 'kanji' 
            ? "font-['Klee_One'] text-3xl"  
            : getDynamicFontSize(card.content, 'button') + " font-sans uppercase" // Dùng chung logic 'button'
        }`}
>
    {card.content}
</button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <p className="mt-4 text-white/50 text-[10px] font-bold uppercase tracking-widest animate-pulse">Chọn cặp tương ứng</p>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
};

const EditVocabModal = ({ isOpen, onClose, data, onSave, dbData }) => {
    const [reading, setReading] = useState('');
    const [meaning, setMeaning] = useState('');
    const [hanviet, setHanviet] = useState(''); 

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && data) {
            setReading(data.reading || '');
            setMeaning(data.meaning || '');
            setHanviet(data.hanviet || ''); // <--- 2. Load dữ liệu Hán Việt nếu có
        }
    }, [isOpen, data]);

    const handleRestore = () => {
        if (!data) return;
        
        // Lấy lại dữ liệu gốc từ DB
        const originalInfo = dbData?.TUVUNG_DB?.[data.word] || { reading: '', meaning: '' };
        // Lấy lại Hán việt gốc (tự động ghép từ các chữ đơn lẻ)
        const originalHanviet = data.word.split('').map(c => dbData?.KANJI_DB?.[c]?.sound || '').filter(s => s).join(' ');

        const restoredReading = originalInfo.reading || '';
        const restoredMeaning = originalInfo.meaning || '';

        setReading(restoredReading);
        setMeaning(restoredMeaning);
        setHanviet(originalHanviet); // <--- 3. Khôi phục Hán Việt tự động

        // Lưu luôn 4 tham số
        onSave(data.word, restoredReading, restoredMeaning, originalHanviet);
    };

    if (!isOpen || !data) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200" onClick={e => e.stopPropagation()}>
                
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-800 uppercase flex items-center gap-2">✏️ CHỈNH SỬA TỪ VỰNG</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Từ vựng (Gốc)</label>
                        <div className="text-2xl font-black text-gray-800 font-sans border-b border-gray-200 pb-2">{data.word}</div>
                    </div>

                    {/* --- 4. THÊM Ô NHẬP ÂM HÁN VIỆT --- */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Âm Hán Việt</label>
                        <input 
                            type="text" 
                            value={hanviet}
                            onChange={(e) => setHanviet(e.target.value.toUpperCase())} 
                            placeholder="Ví dụ: NHẬT BẢN NGỮ"
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold uppercase transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cách đọc (Furigana)</label>
                        <input type="text" value={reading} onChange={(e) => setReading(e.target.value)} placeholder="Ví dụ: にほんご" className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ý nghĩa (Tiếng Việt)</label>
                        <input 
                            type="text" 
                            value={meaning} 
                            onChange={(e) => setMeaning(e.target.value)} 
                            placeholder="Ví dụ: tiếng Nhật" 
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all" 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button onClick={handleRestore} className="flex items-center justify-center gap-1.5 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all active:scale-95 text-[11px] uppercase tracking-wider border border-red-100">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Khôi phục
                        </button>
                        {/* 5. TRUYỀN THÊM HANVIET VÀO HÀM SAVE */}
                        <button onClick={() => onSave(data.word, reading, meaning, hanviet)} className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 transition-all active:scale-95 text-[11px] uppercase tracking-wider">
                            Lưu thay đổi
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
// --- COMPONENT TRUNG GIAN ĐỂ FETCH SVG CHO PREVIEW LIST ---
const KanjiAnimationContainer = ({ char, dbData, onClose }) => {
    const { paths, fullSvg } = useKanjiSvg(char);
    return (
        <KanjiAnimationModal 
            char={char}
            paths={paths}
            fullSvg={fullSvg}
            dbData={dbData}
            isOpen={true}
            onClose={onClose}
        />
    );
};
// --- COMPONENT: BẢNG DANH SÁCH XEM TRƯỚC VÀ CHỈNH SỬA (MONOCHROME) ---
const PreviewListModal = ({ isOpen, onClose, onStart, text, mode, dbData, targetAction, customVocabData, onSaveVocab }) => {
    const [editingWord, setEditingWord] = useState(null);
    const [editForm, setEditForm] = useState({ reading: '', meaning: '', hanviet: '' });
    
    // --- STATE MỚI CHO HOẠT HỌA KANJI ---
    const [animChar, setAnimChar] = useState(null);

    React.useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const { needsEdit, ready, kanjiList } = React.useMemo(() => {
        if (mode === 'kanji') {
            const chars = Array.from(new Set(text.replace(/[\n\s]/g, ''))).filter(c => c);
            return { kanjiList: chars, needsEdit: [], ready: [] };
        } else {
            const words = Array.from(new Set(text.split(/[\n;]+/).map(w => w.trim()).filter(w => w)));
            const missing = [];
            const complete = [];

            words.forEach(word => {
                const info = customVocabData[word] || dbData?.TUVUNG_DB?.[word] || {};
                const hanvietStr = word.split('').map(c => dbData?.KANJI_DB?.[c]?.sound || '').filter(s => s).join(' ');
                
                const wordData = {
                    word,
                    reading: info.reading || '',
                    meaning: info.meaning || '',
                    hanviet: info.hanviet || hanvietStr
                };

                if (!wordData.meaning || !wordData.reading) {
                    missing.push(wordData);
                } else {
                    complete.push(wordData);
                }
            });
            return { kanjiList: [], needsEdit: missing, ready: complete };
        }
    }, [text, mode, dbData, customVocabData]);

    if (!isOpen) return null;

    const startEdit = (item) => {
        setEditingWord(item.word);
        setEditForm({ reading: item.reading, meaning: item.meaning, hanviet: item.hanviet });
    };

    const saveEdit = () => {
        onSaveVocab(editingWord, editForm.reading, editForm.meaning, editForm.hanviet);
        setEditingWord(null);
    };

    const restoreEdit = (word) => {
        const originalInfo = dbData?.ORIGINAL_TUVUNG_DB?.[word] || dbData?.TUVUNG_DB?.[word] || { reading: '', meaning: '' };
        const originalHanviet = word.split('').map(c => dbData?.KANJI_DB?.[c]?.sound || '').filter(s => s).join(' ');
        setEditForm({ reading: originalInfo.reading || '', meaning: originalInfo.meaning || '', hanviet: originalHanviet });
    };

    return (
        <>
            <div className="fixed inset-0 z-[400] flex justify-center items-center bg-gray-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] md:max-h-[85vh] animate-in zoom-in-95 duration-300 border border-gray-200">
                    
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Danh sách cần học</h2>
                            <p className="text-xs text-gray-500 font-medium">Kiểm tra lại dữ liệu trước khi bắt đầu</p>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors">✕</button>
                    </div>

                    {/* Body (List) */}
                    <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6 bg-white">
                        {mode === 'kanji' ? (
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Tổng cộng: {kanjiList.length} chữ</p>
                                <div className="flex flex-wrap gap-2">
                                    {kanjiList.map((char, i) => {
                                        const info = dbData?.KANJI_DB?.[char] || {};
                                        return (
                                            <div 
                                                key={i} 
                                                onClick={() => setAnimChar(char)} // BẤM ĐỂ MỞ HOẠT HỌA
                                                className="flex flex-col items-center justify-center border border-gray-200 rounded-xl p-2 w-16 h-20 bg-gray-50 hover:border-blue-500 hover:bg-blue-50 transition-colors group cursor-pointer"
                                                title="Bấm để xem nét vẽ"
                                            >
                                                {/* ĐỔI MÀU CHỮ THÀNH XANH DƯƠNG KHI HOVER */}
                                                <span className="text-3xl font-['Klee_One'] text-gray-900 leading-none group-hover:text-blue-600 transition-colors">{char}</span>
                                                <span className="text-[9px] font-bold text-gray-500 mt-1 truncate w-full text-center group-hover:text-blue-600 transition-colors">{info.sound || '---'}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* PHẦN 1: CẦN BỔ SUNG */}
                                {needsEdit.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="w-2 h-2 rounded-full bg-gray-900 animate-pulse"></span>
                                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Cần bổ sung ({needsEdit.length})</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {needsEdit.map((item, i) => (
                                                <div key={i} className="border-2 border-gray-900 rounded-xl p-4 bg-gray-50/50 shadow-sm relative">
                                                    {editingWord === item.word ? (
                                                        <div className="space-y-3">
                                                            <div className="font-bold text-lg text-gray-900 border-b border-gray-200 pb-2">{item.word}</div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Âm Hán Việt</label>
                                                                    <input type="text" value={editForm.hanviet} onChange={e => setEditForm({...editForm, hanviet: e.target.value.toUpperCase()})} className="w-full mt-1 p-2 border border-gray-300 rounded focus:border-gray-900 outline-none text-sm font-bold uppercase"/>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Cách đọc</label>
                                                                    <input type="text" value={editForm.reading} onChange={e => setEditForm({...editForm, reading: e.target.value})} className="w-full mt-1 p-2 border border-gray-300 rounded focus:border-gray-900 outline-none text-sm"/>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Ý nghĩa</label>
                                                                    <input type="text" value={editForm.meaning} onChange={e => setEditForm({...editForm, meaning: e.target.value})} className="w-full mt-1 p-2 border border-gray-300 rounded focus:border-gray-900 outline-none text-sm"/>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 justify-end mt-2">
                                                                <button onClick={() => restoreEdit(item.word)} className="px-3 py-1.5 text-[10px] font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300 uppercase transition-all">Khôi phục</button>
                                                                <button onClick={() => setEditingWord(null)} className="px-3 py-1.5 text-[10px] font-bold text-gray-500 border border-gray-300 rounded hover:bg-gray-100 uppercase transition-all">Hủy</button>
                                                                <button onClick={saveEdit} className="px-5 py-1.5 text-[10px] font-bold text-white bg-gray-900 rounded hover:bg-black uppercase transition-all">Lưu</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex flex-col">
                                                                <span className="text-xl font-bold text-gray-900">{item.word}</span>
                                                                <span className="text-xs text-gray-500 font-medium italic mt-1">
                                                                    {item.hanviet && `[${item.hanviet}] `}
                                                                    <span className={item.reading ? "" : "text-gray-400"}>{item.reading || '(Thiếu cách đọc)'}</span>
                                                                    {" • "}
                                                                    <span className={item.meaning ? "" : "text-gray-400"}>{item.meaning || '(Thiếu ý nghĩa)'}</span>
                                                                </span>
                                                            </div>
                                                            <button onClick={() => startEdit(item)} className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all">SỬA</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* PHẦN 2: ĐÃ ĐẦY ĐỦ */}
                                {ready.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Đã đầy đủ ({ready.length})</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {ready.map((item, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`border rounded-xl p-4 bg-white transition-colors group ${
                                                        editingWord === item.word 
                                                            ? 'sm:col-span-2 border-2 border-gray-900 shadow-sm' 
                                                            : 'border-gray-200 hover:border-gray-900'
                                                    }`}
                                                >
                                                    {editingWord === item.word ? (
                                                        <div className="space-y-3">
                                                            <div className="font-bold text-lg text-gray-900 border-b border-gray-200 pb-2">{item.word}</div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Âm Hán Việt</label>
                                                                    <input type="text" value={editForm.hanviet} onChange={e => setEditForm({...editForm, hanviet: e.target.value.toUpperCase()})} className="w-full mt-1 p-2 border border-gray-300 rounded focus:border-gray-900 outline-none text-sm font-bold uppercase"/>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Cách đọc</label>
                                                                    <input type="text" value={editForm.reading} onChange={e => setEditForm({...editForm, reading: e.target.value})} className="w-full mt-1 p-2 border border-gray-300 rounded focus:border-gray-900 outline-none text-sm"/>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Ý nghĩa</label>
                                                                    <input type="text" value={editForm.meaning} onChange={e => setEditForm({...editForm, meaning: e.target.value})} className="w-full mt-1 p-2 border border-gray-300 rounded focus:border-gray-900 outline-none text-sm"/>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 justify-end mt-2">
                                                                <button onClick={() => restoreEdit(item.word)} className="px-3 py-1.5 text-[10px] font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300 uppercase transition-all">Khôi phục</button>
                                                                <button onClick={() => setEditingWord(null)} className="px-3 py-1.5 text-[10px] font-bold text-gray-500 border border-gray-300 rounded hover:bg-gray-100 uppercase transition-all">Hủy</button>
                                                                <button onClick={saveEdit} className="px-5 py-1.5 text-[10px] font-bold text-white bg-gray-900 rounded hover:bg-black uppercase transition-all">Lưu</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-between items-center h-full">
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="text-lg font-bold text-gray-900 truncate">{item.word}</span>
                                                                <span className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">
                                                                    {item.hanviet && `[${item.hanviet}] `}
                                                                    {item.reading} • {item.meaning}
                                                                </span>
                                                            </div>
                                                            <button onClick={() => startEdit(item)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ml-2 opacity-100 md:opacity-0 group-hover:opacity-100">
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-gray-200 bg-gray-50 flex gap-3">
                        <button onClick={onClose} className="px-6 py-4 rounded-xl border border-gray-300 text-gray-600 font-bold text-xs uppercase hover:bg-gray-100 transition-all">Quay lại</button>
                        <button 
                            onClick={() => onStart(targetAction)} 
                            disabled={(mode === 'vocab' && ready.length === 0) || (mode === 'kanji' && kanjiList.length === 0)}
                            className={`flex-1 py-4 font-black rounded-xl shadow-lg transition-all uppercase tracking-widest flex justify-center items-center gap-2 
                                ${((mode === 'vocab' && ready.length === 0) || (mode === 'kanji' && kanjiList.length === 0))
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50' 
                                    : 'bg-gray-900 hover:bg-black text-white active:scale-[0.98]'
                                }`}
                        >
                            BẮT ĐẦU
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Component Hoạt Họa Gọi Tách Rời Phía Ngoài (z-index cao hơn) */}
            {animChar && (
                <KanjiAnimationContainer 
                    char={animChar} 
                    dbData={dbData} 
                    onClose={() => setAnimChar(null)} 
                />
            )}
        </>
    );
};
// --- COMPONENT: KANJI MỖI NGÀY (ĐÃ FIX LỖI KHÔNG KHỚP CHỮ VÀ NGHĨA) ---
const KanjiOfTheDay = () => {
    // 1. DANH SÁCH 10 KANJI
    const KANJI_LIST = React.useMemo(() => [
        { char: '禅', sound: 'THIỀN', meaning: 'Thiền định, tĩnh tâm.' },
        { char: '道', sound: 'ĐẠO', meaning: 'Con đường, đạo lý.' },
        { char: '心', sound: 'TÂM', meaning: 'Trái tim, tâm hồn.' },
        { char: '夢', sound: 'MỘNG', meaning: 'Giấc mơ, hoài bão.' },
        { char: '愛', sound: 'ÁI', meaning: 'Tình cảm, yêu thương.' },
        { char: '静', sound: 'TĨNH', meaning: 'Yên lặng, thanh tĩnh.' },
        { char: '志', sound: 'CHÍ', meaning: 'Ý chí, quyết tâm.' },
        { char: '悟', sound: 'NGỘ', meaning: 'Giác ngộ, thức tỉnh' },
        { char: '学', sound: 'HỌC', meaning: 'Học hành, học tập.' }, // Đã sửa lại âm Hán Việt chuẩn
        { char: '忍', sound: 'NHẪN', meaning: 'Nhẫn nại, kiên nhẫn.' }
    ], []);

    // 2. STATE LƯU TRỮ (Sửa lỗi: Chọn ngẫu nhiên ngay lúc khởi tạo state)
    const [currentKanji, setCurrentKanji] = useState(() => {
        const randomIndex = Math.floor(Math.random() * KANJI_LIST.length);
        return KANJI_LIST[randomIndex];
    }); 
    const [replayKey, setReplayKey] = useState(0);

    // XÓA BỎ useEffect() chọn ngẫu nhiên gây lỗi ở đây

    // Gọi hàm SVG để lấy tọa độ nét vẽ dựa trên chữ đã chọn
    const { paths } = useKanjiSvg(currentKanji.char);

    // 4. VÒNG LẶP HOẠT HỌA VÔ TẬN
    useEffect(() => {
        if (paths.length === 0) return;
        
        // Thời gian vẽ 1 nét (4s) + (Tổng số nét * Độ trễ 0.5s) + Nghỉ 2s trước khi lặp lại
        const totalDuration = (4 + paths.length * 0.5 + 2) * 1000; 
        
        const timer = setInterval(() => {
            setReplayKey(prev => prev + 1); // Đổi key ép SVG vẽ lại từ đầu
        }, totalDuration);

        return () => clearInterval(timer);
    }, [paths, currentKanji.char]);

    return (
        <div className="flex w-full max-w-[400px] mx-auto ml-auto aspect-square bg-[#f8f8f9] rounded-3xl border border-zinc-200 shadow-sm flex-col p-7 transition-transform hover:-translate-y-1 duration-300">
            
            {/* TRÊN CÙNG: TIÊU ĐỀ */}
            <div className="w-full text-center">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.25em]">
                    Kanji mỗi ngày
                </span>
            </div>

            {/* Ở GIỮA: CHỮ KANJI (To, Đen, Không chạm lề) */}
            <div className="flex-1 w-full flex items-center justify-center relative my-2 overflow-hidden">
                {paths.length > 0 ? (
                    <svg key={replayKey} viewBox="0 0 109 109" className="w-[85%] h-[85%]">
                        {paths.map((d, index) => (
                            <path 
                                key={`${currentKanji.char}-${index}`} 
                                d={d} 
                                className="stroke-anim-path" 
                                style={{ 
                                    animationDuration: '4s', // Tốc độ vẽ chậm (4 giây/nét)
                                    animationDelay: `${index * 0.5}s`, // Chờ 0.5 giây mới vẽ nét tiếp theo
                                    stroke: '#1a1a1a', // Màu Đen nhám (Zen Black)
                                    strokeWidth: 3 
                                }} 
                            />
                        ))}
                    </svg>
                ) : (
                    <span className="text-[9rem] font-bold text-[#1a1a1a] font-['Klee_One'] select-none">
                        {currentKanji.char}
                    </span>
                )}
            </div>

            {/* DƯỚI CÙNG: ÂM HÁN VIỆT & Ý NGHĨA */}
            <div className="w-full text-center bg-white py-3.5 px-4 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100 z-10">
                <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-sm font-black uppercase tracking-widest text-zinc-800">
                        {currentKanji.sound}
                    </span>
                    <span className="text-[13px] font-medium text-zinc-500 truncate w-full px-2">
                        {currentKanji.meaning}
                    </span>
                </div>
            </div>

        </div>
    );
};

// --- COMPONENT: MODAL MỜI CAFE (BẢN TỐI GIẢN - CÓ NÚT "LẦN SAU NHÉ") ---
const DonateModal = ({ isOpen, onClose }) => {
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText("99931082002");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[280px] overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-100 p-6 flex flex-col items-center" onClick={e => e.stopPropagation()}>
                
                <p className="text-sm font-bold text-zinc-800 mb-5 text-center leading-snug">
                    Mời mình một ly cafe để tiếp tục duy trì dự án nhé!
                </p>

                {/* QR Code */}
                <div className="w-44 h-44 bg-white border border-zinc-200 rounded-xl p-1 mb-4 shadow-sm">
              
                    <img src="https://i.ibb.co/JWGwcTL1/3381513652021492183.jpg" alt="QR Code" className="w-full h-full object-contain rounded-lg" />
                </div>

         
                <div 
                    onClick={handleCopy}
                    className="w-full bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl p-3 mb-4 flex items-center justify-between cursor-pointer transition-all active:scale-95 group"
                    title="Bấm để copy số tài khoản"
                >
                    <div className="flex flex-col items-start">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">MB Bank</span>
                        <span className="text-sm font-black text-zinc-900 tracking-wider">99931082002</span>
                    </div>
                    <div className="text-zinc-400 group-hover:text-zinc-900 transition-colors">
                        {copied ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 animate-in zoom-in"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        )}
                    </div>
                </div>

      
                <button 
                    onClick={onClose} 
                    className="w-full py-3.5 bg-gray-900 hover:bg-black text-white text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95 uppercase tracking-widest mt-1"
                >
                    Lần sau nhé
                </button>

            </div>
        </div>
    );
};
            
// --- COMPONENT: TRANG CHỦ CHUYÊN NGHIỆP ---
const LandingPage = ({ srsData, onOpenReviewList, onOpenSetup, onOpenDictionary, dbData, onOpenDictation }) => {
    const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);
    const featuresRef = useRef(null);
    const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const notifRef = useRef(null);
    
React.useEffect(() => {
        if (isDocsModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isDocsModalOpen]);
    const notifications = [
        { 
            id: 5, 
            title: '🔍 HỆ THỐNG KANJI THEO BỘ THỦ', 
            date: '27/03/2026', 
            content: 'Giờ đây bạn có thể dễ dàng tra cứu Kanji sắp xếp theo bộ thủ hoặc nhập trực tiếp âm Hán Việt. Bấm ngay vào "TRA CỨU KANJI" ở trang chủ để khám phá nhé!'
        }
        
    ];

    const [readNotifIds, setReadNotifIds] = useState(() => {
        const saved = localStorage.getItem('phadao_read_notifs');
        return saved ? JSON.parse(saved) : [];
    });

    const [sessionUnreadIds] = useState(() => {
        return notifications.map(n => n.id).filter(id => !readNotifIds.includes(id));
    });

    const hasNewNotif = notifications.some(n => !readNotifIds.includes(n.id));

    const handleToggleNotif = () => {
        setIsNotifOpen(!isNotifOpen);
        if (!isNotifOpen && hasNewNotif) {
            const allIds = notifications.map(n => n.id);
            setReadNotifIds(allIds);
            localStorage.setItem('phadao_read_notifs', JSON.stringify(allIds));
        }
    };

    useEffect(() => {
        function handleClickOutside(event) {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const dueCharsCount = React.useMemo(() => {
        const now = Date.now();
        return Object.keys(srsData || {}).filter(char => {
            const data = srsData[char];
            return !data.isDone && data.nextReview !== null && (data.nextReview === 0 || data.nextReview <= now);
        }).length;
    }, [srsData]);

    const scrollToFeatures = () => {
        featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // --- LOGIC UI THÔNG BÁO CHUNG (Dùng cho cả PC và Mobile) ---
    const NotificationDropdown = () => (
        <div className="absolute top-full right-0 mt-3 w-80 bg-white border border-zinc-200 rounded-2xl shadow-[0_10px_40px_rgb(0,0,0,0.1)] z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden origin-top-right">
            <div className="px-4 py-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <span className="font-black text-sm text-zinc-800 uppercase tracking-wide">Thông báo</span>
            </div>
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                {notifications.length > 0 ? (
                    notifications.map(notif => {
                        const isNew = sessionUnreadIds.includes(notif.id);
                        return (
                            <div key={notif.id} className={`p-3 rounded-xl transition-colors ${isNew ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-zinc-50'}`}>
                                <div className="flex gap-3">
                                    <div className="mt-1">
                                        {isNew ? <div className="w-2 h-2 rounded-full bg-blue-600"></div> : <div className="w-2 h-2 rounded-full bg-zinc-300"></div>}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className={`text-sm mb-0.5 ${isNew ? 'font-bold text-zinc-900' : 'font-semibold text-zinc-700'}`}>{notif.title}</h4>
                                        <p className="text-[10px] text-zinc-400 font-medium mb-1.5">{notif.date}</p>
                                        <p className="text-xs text-zinc-600 leading-relaxed">{notif.content}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="py-10 flex flex-col items-center text-center text-zinc-400">Trống trơn!</div>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-white text-zinc-900 font-sans relative">
            {/* NAVBAR */}
            <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white shadow-md">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                            </div>
                            <span className="text-xl font-bold tracking-tight">PHÁ ĐẢO<span className="font-light"> TIẾNG NHẬT</span></span>
                        </div>
                        
                        {/* Menu PC: GIỮ NGUYÊN 100% */}
                        <div className="hidden md:flex items-center gap-5">
                           
                            <div className="relative flex items-center" ref={notifRef}>
                                <button onClick={handleToggleNotif} className="relative p-2 text-zinc-500 hover:text-zinc-900 rounded-full hover:bg-zinc-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                                    {hasNewNotif && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>}
                                </button>
                                {isNotifOpen && <NotificationDropdown />}
                            </div>
                            <div className="h-4 w-px bg-zinc-200 mx-2"></div>
                            <a href="https://zalo.me/g/pe2rgziiyugzdwok74bd" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-zinc-900 text-white rounded-full text-sm font-bold hover:bg-zinc-800 shadow-sm">Tham gia Nhóm</a>
                        </div>
                        
                        {/* NÚT MOBILE: ĐÃ THAY 3 GẠCH BẰNG CHUÔNG */}
                        <div className="md:hidden relative flex items-center" ref={notifRef}>
                            <button onClick={handleToggleNotif} className="relative p-2 text-zinc-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                                {hasNewNotif && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>}
                            </button>
                            {isNotifOpen && <NotificationDropdown />}
                        </div>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <section className="pt-28 pb-16 px-6 lg:px-8 max-w-7xl mx-auto min-h-[90vh] flex items-center">
                <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
                    <div className="animate-in slide-in-from-left-8 duration-700">
                        {/* Ẩn trên mobile bằng hidden md:inline-block */}
                        <div className="hidden md:inline-block px-3 py-1 mb-5 border border-zinc-200 rounded-full bg-zinc-50">
                            <span className="text-[10px] font-bold text-zinc-600 tracking-wider uppercase">Bước tiếp hành trình của bạn</span>
                        </div>
                        <h1 className="text-3xl md:text-[4rem] font-bold tracking-tight leading-[1.05] mb-6 text-zinc-900">
                            Nơi nào có ý chí <br />
                            <span className="text-zinc-400 font-light italic font-serif">nơi đó có con đường</span>
                        </h1>
                        {/* Ẩn trên mobile bằng hidden md:block */}
                        <p className="hidden md:block text-lg text-zinc-500 mb-8 max-w-md font-medium leading-relaxed">
                            <span className="font-jp">日本語を勉強しましょう。</span>
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={scrollToFeatures} className="px-7 py-3.5 bg-zinc-900 text-white rounded-full text-sm font-bold hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group">
                                Bắt đầu học
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><path d="m9 18 6-6-6-6"></path></svg>
                            </button>
                        </div>
                    </div>
                    <KanjiOfTheDay />
                </div>
            </section>

            {/* FEATURES SECTION */}
            <section ref={featuresRef} className="py-20 bg-zinc-50/50 border-t border-zinc-100 min-h-screen flex flex-col justify-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight mb-4 uppercase">Hôm nay bạn muốn học gì?</h2>
                        <p className="text-zinc-500 max-w-2xl mx-auto text-lg">Phương pháp học Flashcard, lặp lại ngắt quãng, và nhiều thứ khác...</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                       {/* 8. TỪ ĐIỂN BỘ THỦ */}
                        <div onClick={onOpenDictionary} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 relative overflow-hidden">
                            <div className="absolute top-4 right-4 bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm animate-pulse">
                                MỚI
                            </div>
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path><path d="M8 7h6"></path><path d="M8 11h8"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1 text-zinc-900">TRA CỨU KANJI</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">XẾP THEO BỘ THỦ</p>
                        </div>
                        {/* 1. CHẾ ĐỘ HỌC */}
                        <div onClick={() => onOpenSetup('game')} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1">
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 18V5"></path><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"></path><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"></path><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"></path><path d="M18 18a4 4 0 0 0 2-7.464"></path><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"></path><path d="M6 18a4 4 0 0 1-2-7.464"></path><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1">CHẾ ĐỘ HỌC</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Kanji & từ vựng</p>
                        </div>

                        {/* 2. FLASHCARD */}
                        <div onClick={() => onOpenSetup('flashcard')} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1">
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1">FLASHCARD</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Kanji & từ vựng</p>
                        </div>

                        {/* 3. TỰ LUẬN */}
                        <div onClick={() => onOpenSetup('essay')} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1">
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1">TỰ LUẬN</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Kanji & từ vựng</p>
                        </div>

                        {/* 4. CHIA ĐỘNG TỪ */}
                        <div onClick={() => onOpenSetup('conjugate')} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 relative overflow-hidden">
                            
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1 text-zinc-900">CHIA ĐỘNG TỪ</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Từ vựng & ngữ pháp</p>
                        </div>
    {/* 7. LUYỆN KAIWA */}
<div onClick={() => onOpenSetup('kaiwa')} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 relative overflow-hidden">
    <div className="absolute top-4 right-4 bg-indigo-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md animate-pulse">
        MỚI
    </div>
    <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
    </div>
    <h3 className="text-xl font-bold mb-1 text-zinc-900">LUYỆN KAIWA</h3>
    <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Shadowing & Phản xạ</p>
</div>
                                 {/* 8. LUYỆN NGHE CHÍNH TẢ */}
<div onClick={() => onOpenDictation()} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 relative overflow-hidden">
    <div className="absolute top-4 right-4 bg-green-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md animate-pulse">
        MỚI
    </div>
    <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>
    </div>
    <h3 className="text-xl font-bold mb-1 text-zinc-900">LUYỆN NGHE</h3>
    <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Chép chính tả & Đục lỗ</p>
</div>

                        {/* 5. LỊCH TRÌNH HỌC */}
                        <div onClick={onOpenReviewList} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 relative overflow-hidden">
                            {dueCharsCount > 0 && (
                                <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full animate-pulse uppercase tracking-wider shadow-md">Cần ôn</div>
                            )}
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1">LỊCH TRÌNH HỌC</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Kanji</p>
                        </div>
{/* 6. TÀI LIỆU HỌC (Thêm mới vào đây) */}
<div onClick={() => setIsDocsModalOpen(true)} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 relative overflow-hidden">
    
    <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
    </div>
    <h3 className="text-xl font-bold mb-1 text-zinc-900">TÀI LIỆU HỌC</h3>
    <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">TỪ N5 ĐẾN N1</p>
</div>


                        {/* 7. LUYỆN JLPT */}
                        <div className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm opacity-50 cursor-not-allowed relative overflow-hidden">
                            <div className="absolute top-4 right-4 bg-zinc-200 text-zinc-500 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                                Sắp ra mắt
                            </div>
                            <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-6 text-zinc-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1 text-zinc-400">LUYỆN JLPT</h3>
                            <p className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wide">Thi thử, làm đề N5-N1</p>
                        </div>

                    </div>

  
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-white border-t border-zinc-100 py-12 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:flex-row gap-4 md:gap-6">
                        
                        {/* 1. Nút Tiktok */}
                        <a href="https://www.tiktok.com/@phadaotiengnhat" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                            <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                            </div>
                            <span className="font-bold tracking-tight text-zinc-900">Tiktok</span>
                        </a>
                        
                        {/* Vách ngăn mờ (Chỉ hiện trên PC) */}
                        <div className="h-4 w-px bg-zinc-200 hidden md:block"></div>
                        
                        {/* 2. Nút Mời Cafe (Mới thêm) */}
                        <button onClick={() => setIsDonateModalOpen(true)} className="flex items-center gap-2 group text-zinc-600 hover:text-zinc-900 transition-colors active:scale-95">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-rotate-12 transition-transform"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
                            <span className="font-bold tracking-tight text-sm">Mời cafe</span>
                        </button>
                        
                        {/* Nút Mobile (Sẽ bị ẩn trên giao diện lớn) */}
                     
                        <a href="https://zalo.me/g/pe2rgziiyugzdwok74bd" target="_blank" rel="noopener noreferrer" className="md:hidden text-sm font-bold text-zinc-600 uppercase tracking-widest">Nhóm học tập</a>
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">© 2026 Phá Đảo Tiếng Nhật.</p>
                </div>
            </footer>

            {/* Gọi DonateModal ở ngay dưới Footer */}
            <DonateModal 
                isOpen={isDonateModalOpen} 
                onClose={() => setIsDonateModalOpen(false)} 
            />
                    
            {/* MODAL TÀI LIỆU (Giữ nguyên) */}
             {isDocsModalOpen && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 flex flex-col max-h-[80vh]">
            
            {/* Header của Popup */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
{/* Bắt đầu Icon 2D */}
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
</svg>
{/* Kết thúc Icon 2D */}
TÀI LIỆU HỌC TẬP
</h3>
                <button onClick={() => setIsDocsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Danh sách tài liệu (Cuộn được nếu dài) */}
            <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">

{/* Bộ sách luyện đề */}
                <a href="https://drive.google.com/drive/folders/19JT79eX8-xn6jweibSj8vzxnugJwjI4C" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-purple-700 pb-1">Sách luyện đề JLPT (N5-N1)</p>
                        <p className="text-[10px] text-gray-400">15 quyển</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-purple-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
                
                {/* 2139 kanji */}
                <a href="https://drive.google.com/file/d/1Q3bbd3Aao7R71wemjESHddbvmXWYe542/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-purple-700 pb-1">2139 Hán tự (N5-N1)</p>
                        <p className="text-[10px] text-gray-400">PDF • 797 KB</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-purple-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>

                {/* quy tắc chuyển âm */}
                <a href="https://drive.google.com/file/d/17L2ufF9P0GfLrhzE_yCsAqjXYSYrhTxU/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-purple-700 pb-1">Quy tắc chuyển âm</p>
                        <p className="text-[10px] text-gray-400">PDF • 128 KB</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-purple-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>

                {/* Flashcard Kanji */}
                <a href="https://quizlet.com/join/mE5CzMyT7?i=4yxqkk&x=1bqt" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-purple-700 pb-1">Flashcard 2139 kanji N5-N1</p>
                        <p className="text-[10px] text-gray-400">147 học phần</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-purple-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>

    

                {/* nhóm học tập */}
                <a href="https://zalo.me/g/pe2rgziiyugzdwok74bd" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group">
                    {/* Đã đổi: bg-blue -> bg-orange */}
                    <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        {/* Đã đổi: Icon File -> Icon Nhóm người */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-purple-700 pb-1">Thêm nhiều tài liệu khác...</p>
                        <p className="text-[10px] text-gray-400">tham gia nhóm học tập</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-purple-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>

            </div>

            {/* Nút đóng màu đen */}
            <div className="p-4 pt-2 bg-white">
                <button 
                    onClick={() => setIsDocsModalOpen(false)}
                    className="w-full py-3 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl shadow-lg transition-transform active:scale-95"
                >
                    ĐÓNG
                </button>
            </div>

        </div>
    </div>
    )}
        </div>
    );
};
// --- COMPONENT: THANH TÌM KIẾM ĐỘC LẬP (BẢN MONOCHROME CÓ TAG JLPT) ---
const SearchBar = ({ mode, dbData, onSelectResult, onSelectAll, isDictionary, onKanjiSearch }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const searchInputRef = useRef(null);
    const scrollRef = useRef(null);

    // Kiểm tra xem input có chứa Kanji không
    const isInputKanji = /[\u4E00-\u9FAF]/.test(searchTerm);

    // Cuộn tự động khi dùng phím mũi tên
    useEffect(() => {
        if (scrollRef.current && searchResults.length > 0) {
            const indexToScroll = mode === 'vocab' ? activeIndex + 1 : activeIndex;
            const activeItem = scrollRef.current.childNodes[indexToScroll];
            if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [activeIndex, searchResults.length, mode]);

    const getJLPTLevel = (char) => {
        if (!dbData || !dbData.KANJI_LEVELS) return null;
        if (dbData.KANJI_LEVELS.N5?.includes(char)) return 'N5';
        if (dbData.KANJI_LEVELS.N4?.includes(char)) return 'N4';
        if (dbData.KANJI_LEVELS.N3?.includes(char)) return 'N3';
        if (dbData.KANJI_LEVELS.N2?.includes(char)) return 'N2';
        if (dbData.KANJI_LEVELS.N1?.includes(char)) return 'N1';
        return null;
    };

    const handleSearchRealtime = (val) => {
        setSearchTerm(val);
        const query = val.toLowerCase().trim();
        const queryNoAccent = removeAccents(query);

        // NẾU LÀ TỪ ĐIỂN VÀ NHẬP KANJI -> KHÔNG HIỆN GỢI Ý
        if (isDictionary && /[\u4E00-\u9FAF]/.test(val)) {
            setSearchResults([]);
            return;
        }

        if (!query || !dbData) {
            setSearchResults([]);
            return;
        }

        let matches = [];

        if (mode === 'vocab') {
            const isKanjiVocab = query.match(/[\u4E00-\u9FAF]/);
            if (!isKanjiVocab) { setSearchResults([]); return; }

            if (dbData.TUVUNG_DB) {
                Object.entries(dbData.TUVUNG_DB).forEach(([word, info]) => {
                    if (word.includes(val.trim())) matches.push({ char: word, sound: info.reading, meaning: info.meaning, type: 'vocab', length: word.length });
                });
            }
            matches.sort((a, b) => a.length - b.length);
            const uniqueMatches = [];
            matches.forEach(current => {
                const isRedundant = uniqueMatches.some(base => {
                    if (current.char.startsWith(base.char)) {
                        if (current.char.endsWith('ます') || current.char.endsWith('します')) return true;
                    }
                    return false;
                });
                if (!isRedundant) uniqueMatches.push(current);
            });
            matches = uniqueMatches.slice(0, 10); 
        } else {
            Object.entries(dbData.KANJI_DB || {}).forEach(([char, info]) => {
                if (info.sound) {
                    const sound = info.sound.toLowerCase();
                    const soundNoAccent = removeAccents(sound);
                    let priority = 99;
                    if (sound === query) priority = 1;
                    else if (soundNoAccent === queryNoAccent) priority = 2;
                    else if (sound.includes(query)) priority = 3;
                    else if (soundNoAccent.includes(queryNoAccent)) priority = 4;
                    
                    if (priority < 99) matches.push({ char, ...info, type: 'kanji', priority, sound });
                }
            });
            matches.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.sound.localeCompare(b.sound);
            });
            matches = matches.slice(0, 10);
        }
        setSearchResults(matches);
        setActiveIndex(0);
    };

    const handleSelect = (item) => {
        onSelectResult(item); 
        setSearchTerm('');
        setSearchResults([]);
        searchInputRef.current?.focus();
    };

    const handleSelectAll = () => {
        if (onSelectAll) onSelectAll(searchResults);
        setSearchTerm('');
        setSearchResults([]);
        searchInputRef.current?.focus();
    };

    // Hàm xử lý khi bấm nút Search hoặc Enter với Kanji
    const handleKanjiSubmit = () => {
        if (!searchTerm) return;
        // Lọc SẠCH mọi thứ không phải Kanji (Kể cả dấu câu, chữ la tinh, khoảng trắng)
        const cleanKanji = searchTerm.replace(/[^\u4E00-\u9FAF]/g, '');
        // Lọc trùng lặp
        const uniqueKanji = Array.from(new Set(cleanKanji)).join('');
        
        if (uniqueKanji && onKanjiSearch) {
            onKanjiSearch(uniqueKanji);
            setSearchTerm('');
            searchInputRef.current?.blur();
        }
    };
const handleBlur = () => {
        if (isDictionary && searchTerm) {
            if (isInputKanji) {
                // Nếu có Kanji -> Xóa sạch khoảng trắng, chữ la tinh, dấu câu... chỉ để lại Kanji
                const cleanKanji = searchTerm.replace(/[^\u4E00-\u9FAF]/g, '');
                setSearchTerm(cleanKanji);
            } else {
                // Nếu không có Kanji (đang gõ Âm Hán Việt) -> Chỉ cắt khoảng trắng thừa 2 đầu
                setSearchTerm(searchTerm.trim());
            }
        }
    };
    // Lấy Placeholder động
    let placeholderText = mode === 'vocab' ? "Nhập 1 chữ hán để tìm TỪ VỰNG đi kèm..." : "Nhập âm Hán Việt để tìm KANJI...";
    if (isDictionary) placeholderText = "Nhập KANJI hoặc âm HÁN VIỆT...";

    return (
        <div className="relative w-full z-20">
            <input 
                ref={searchInputRef}
                type="text" 
                value={searchTerm}
                onChange={(e) => handleSearchRealtime(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                    // Ưu tiên Enter cho Kanji trong từ điển
                    if (isDictionary && isInputKanji && e.key === 'Enter') {
                        e.preventDefault();
                        handleKanjiSubmit();
                        return;
                    }
                    // Logic cũ cho danh sách gợi ý
                    if (searchResults.length > 0) {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0)); } 
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1)); } 
                        else if (e.key === 'Enter') { e.preventDefault(); handleSelect(searchResults[activeIndex]); }
                    }
                }}
                placeholder={placeholderText} 
                className={`w-full pl-10 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-[16px] focus:outline-none focus:ring-2 focus:ring-gray-900 font-bold placeholder-gray-400 transition-all ${isDictionary && isInputKanji ? 'pr-20' : 'pr-10'}`}
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path strokeWidth="2" strokeLinecap="round" d="m21 21-4.3-4.3"/></svg>

            {/* Nút Tìm Kiếm KANJI (Kính lúp) */}
            {isDictionary && isInputKanji && (
                <button onClick={handleKanjiSubmit} className="absolute right-10 top-1/2 -translate-y-1/2 p-1.5 text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 transition-colors rounded-full shadow-sm animate-in zoom-in" title="Tìm các Kanji này">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
            )}

            {/* Nút Xóa (Dấu X) */}
            {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setSearchResults([]); searchInputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-900 transition-colors bg-transparent rounded-full hover:bg-gray-200">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            )}

            {/* Khung Gợi Ý Kết Quả */}
            {searchResults.length > 0 && (
                <div ref={scrollRef} className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar p-2">
                    {mode === 'vocab' && (
                        <button onClick={handleSelectAll} className="w-full mb-2 py-2 bg-gray-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-black active:scale-95 transition-all">
                            Thêm tất cả ({searchResults.length})
                        </button>
                    )}

                    {searchResults.map((item, idx) => {
                        const level = item.type === 'kanji' ? getJLPTLevel(item.char) : null; 

                        return (
                            <div 
                                key={idx} 
                                onClick={() => handleSelect(item)} 
                                className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-xl transition-colors ${idx === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                            >
                                <span className={`font-['Klee_One'] text-gray-900 font-bold flex-shrink-0 ${mode === 'vocab' ? "text-xl" : "text-2xl"}`}>
                                    {item.char}
                                </span>

                                <div className="flex flex-col justify-center flex-1 min-w-0">
                                    <span className="text-sm font-bold text-gray-800 uppercase leading-tight truncate">
                                        {item.sound} 
                                    </span>
                                    {item.meaning && (
                                        <span className="text-[10px] font-medium text-gray-500 truncate leading-tight mt-0.5">
                                            {item.meaning}
                                        </span>
                                    )}
                                </div>

                                <div className="ml-auto flex-shrink-0 pl-2">
                                    {mode !== 'vocab' && (
                                        level ? (
                                            <div className="px-1.5 py-0.5 rounded text-[9px] font-black border border-gray-300 bg-white text-gray-700">
                                                {level}
                                            </div>
                                        ) : (
                                            <div className="px-1.5 py-0.5 rounded text-[9px] font-black border border-gray-200 bg-gray-50 text-gray-500 uppercase">
                                                Bộ thủ
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- COMPONENT: THƯ VIỆN CHỌN NHANH (ĐÃ TÍCH HỢP THƯ VIỆN ĐỘNG TỪ) ---
const LibraryModal = ({ isOpen, onClose, mode, dbData, srsData, onSelectData, targetAction }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const [randomCount, setRandomCount] = useState(10);
    const [randomVerbCount, setRandomVerbCount] = useState(10); // State riêng cho số lượng động từ

    const [minnaLesson, setMinnaLesson] = useState('');
    const [mimiPart, setMimiPart] = useState('');
    const [mimiLevel, setMimiLevel] = useState('N3');
    const [tangoPart, setTangoPart] = useState('');
    const [tangoLevel, setTangoLevel] = useState('N3');
    const isKanjiEssay = mode === 'kanji' && targetAction === 'essay';
    
    if (!isOpen) return null;

    // --- CÁC HÀM VALIDATE SỐ LƯỢNG ---
    const validateRandomCount = () => {
        let val = parseInt(randomCount);
        if (isNaN(val) || val < 1) { setRandomCount(1); return 1; } 
        else if (val > 50) { setRandomCount(50); return 50; }
        setRandomCount(val);
        return val;
    };

    const validateRandomVerbCount = () => {
        let val = parseInt(randomVerbCount);
        if (isNaN(val) || val < 1) { setRandomVerbCount(1); return 1; } 
        else if (val > 50) { setRandomVerbCount(50); return 50; }
        setRandomVerbCount(val);
        return val;
    };

    const validateMinnaLesson = () => {
        if (minnaLesson === '') return;
        let val = parseInt(minnaLesson);
        if (isNaN(val) || val < 1) setMinnaLesson(1);
        else if (val > 50) setMinnaLesson(50); 
        else setMinnaLesson(val);
    };

    const validateMimiPart = () => {
        if (mimiPart === '') return;
        const limits = { N3: 12, N2: 13, N1: 14 }; 
        const max = limits[mimiLevel];
        let val = parseInt(mimiPart);
        if (isNaN(val) || val < 1) setMimiPart(1);
        else if (val > max) setMimiPart(max);
        else setMimiPart(val);
    };

    const validateTangoPart = () => {
        if (tangoPart === '') return;
        const limits = { N3: 12, N2: 12, N1: 14 }; 
        const max = limits[tangoLevel];
        let val = parseInt(tangoPart);
        if (isNaN(val) || val < 1) setTangoPart(1);
        else if (val > max) setTangoPart(max);
        else setTangoPart(val);
    };

    // --- HÀM TẢI DỮ LIỆU CHUNG ---
    const fetchAndSetData = async (url) => {
        setIsLoading(true); setProgress(20);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Lỗi");
            
            // Nhận diện file JSON chứa mảng (từ vựng hoặc động từ)
            const isJsonArray = url.includes('minna') || url.includes('mimi') || url.includes('tango') || url.includes('dongtu');
            let resultText = "";
            
            if (isJsonArray) {
                const data = await response.json();
                if (!Array.isArray(data) || data.length === 0) {
                    alert("File dữ liệu bị lỗi hoặc rỗng!");
                    setIsLoading(false); return;
                }
                resultText = data.join('\n');
            } else {
                const rawText = await response.text();
                resultText = rawText.replace(/["\n\r\s,\[\]]/g, '');
            }
            
            setProgress(100);
            setTimeout(() => {
                // Tự động xuống dòng cuối cho chế độ text (tránh lỗi nối chữ)
                onSelectData(resultText + (isJsonArray ? '\n' : '')); 
                setIsLoading(false); 
                onClose(); 
            }, 400);
        } catch (error) { 
            alert("Lỗi tải dữ liệu!"); 
            setIsLoading(false); 
        }
    };

    // --- HÀM TẢI KANJI NGẪU NHIÊN ---
    const loadRandomKanji = async (level) => {
        const finalCount = validateRandomCount(); 
        setIsLoading(true); setProgress(20);
        try {
            const response = await fetch(`./data/kanji${level.toLowerCase()}.json`);
            const rawText = await response.text();
            const cleanText = rawText.replace(/["\n\r\s]/g, '');
            const allChars = Array.from(cleanText);
            const unstudiedChars = allChars.filter(char => !srsData[char]);
            const studiedChars = allChars.filter(char => srsData[char]);
            
            let count = finalCount; 
            let selectedPool = "";
            if (unstudiedChars.length >= count) {
                selectedPool = unstudiedChars.sort(() => Math.random() - 0.5).slice(0, count).join('');
            } else {
                const neededMore = count - unstudiedChars.length;
                const extraFromStudied = studiedChars.sort(() => Math.random() - 0.5).slice(0, neededMore);
                selectedPool = unstudiedChars.join('') + extraFromStudied.join('');
            }
            const finalResult = [...selectedPool].sort(() => Math.random() - 0.5).join('');
            
            setProgress(100);
            setTimeout(() => {
                onSelectData(finalResult);
                setIsLoading(false); 
                onClose();
            }, 400);
        } catch (error) { setIsLoading(false); }
    };

    // --- HÀM TẢI ĐỘNG TỪ NGẪU NHIÊN ---
    const loadRandomVerbs = async (level) => {
        const finalCount = validateRandomVerbCount(); 
        setIsLoading(true); setProgress(20);
        try {
            const response = await fetch(`./data/dongtu/dongtu${level.toLowerCase()}.json`);
            if (!response.ok) throw new Error("Không tìm thấy file");
            
            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                alert("File dữ liệu bị lỗi hoặc rỗng!");
                setIsLoading(false); return;
            }
            
            // Xáo trộn và lấy đúng số lượng
            const selectedPool = data.sort(() => Math.random() - 0.5).slice(0, finalCount);
            const finalResult = selectedPool.join('\n');
            
            setProgress(100);
            setTimeout(() => {
                onSelectData(finalResult + '\n');
                setIsLoading(false); 
                onClose();
            }, 400);
        } catch (error) { 
            alert(`Chưa có dữ liệu động từ cho cấp độ ${level}!`);
            setIsLoading(false); 
        }
    };

    const handleSmartLoadVocabulary = () => {
        if (minnaLesson) {
            let valid = minnaLesson < 1 ? 1 : (minnaLesson > 50 ? 50 : minnaLesson);
            fetchAndSetData(`./data/tuvung/minna/minna${valid}.json`);
        } else if (mimiPart) {
            const limits = { N3: 12, N2: 13, N1: 14 };
            let valid = mimiPart < 1 ? 1 : (mimiPart > limits[mimiLevel] ? limits[mimiLevel] : mimiPart);
            fetchAndSetData(`./data/tuvung/mimikara/${mimiLevel.toLowerCase()}/mimi${mimiLevel.toLowerCase()}p${valid}.json`);
        } else if (tangoPart) {
            const limits = { N3: 12, N2: 12, N1: 14 };
            let valid = tangoPart < 1 ? 1 : (tangoPart > limits[tangoLevel] ? limits[tangoLevel] : tangoPart);
            fetchAndSetData(`./data/tuvung/tango/${tangoLevel.toLowerCase()}/tango${tangoLevel.toLowerCase()}p${valid}.json`);
        }
    };

    return (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            
            {isLoading && (
                <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md rounded-3xl">
                    <div className="text-center">
                        <span className="text-xs font-bold text-gray-900 uppercase tracking-widest animate-pulse mb-4 block">Đang nạp dữ liệu... {progress}%</span>
                        <div className="w-48 bg-gray-200 rounded-full h-1.5 overflow-hidden mx-auto">
                            <div className="bg-gray-900 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden cursor-default border border-gray-200 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-gray-900">
                        {targetAction === 'conjugate' ? '📚 THƯ VIỆN ĐỘNG TỪ' : mode === 'kanji' ? '📚 THƯ VIỆN KANJI' : '📚 THƯ VIỆN TỪ VỰNG'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">✕</button>
                </div>
                
                <div className="p-6 space-y-6">
                    {targetAction === 'conjugate' ? (
                        <>
                            {/* --- GIAO DIỆN THƯ VIỆN ĐỘNG TỪ --- */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Lấy ngẫu nhiên</label>
                                <div className="flex gap-3 items-center mb-4">
                                    <input 
                                        type="number" 
                                        value={randomVerbCount} 
                                        onChange={e => setRandomVerbCount(e.target.value)} 
                                        onBlur={validateRandomVerbCount}
                                        className="w-20 p-2.5 text-center border border-gray-300 rounded-lg font-bold text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all" 
                                    />
                                    <span className="text-xs font-bold text-gray-500">động từ</span>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {['N5', 'N4', 'N3', 'N2', 'N1'].map(lvl => (
                                        <button key={`verb-${lvl}`} onClick={() => loadRandomVerbs(lvl)} className="py-2.5 border border-gray-200 bg-white text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white rounded-xl font-bold text-xs transition-all active:scale-95">{lvl}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Danh sách đặc biệt</label>
                                <button onClick={() => fetchAndSetData('./data/dongtu/dongtubatquytac.json')} className="w-full py-3.5 border-2 border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                    ĐỘNG TỪ BẤT QUY TẮC (N5-N4)
                                </button>
                            </div>
                        </>
                    ) : mode === 'kanji' ? (
                        <>
                            {/* --- GIAO DIỆN THƯ VIỆN KANJI --- */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Lấy ngẫu nhiên</label>
                                <div className="flex gap-3 items-center mb-4">
                                   <input 
                                        type="number" 
                                        value={randomCount} 
                                        onChange={e => setRandomCount(e.target.value)} 
                                        onBlur={validateRandomCount}
                                        className="w-20 p-2.5 text-center border border-gray-300 rounded-lg font-bold text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all" 
                                    />
                                    <span className="text-xs font-bold text-gray-500">chữ mới chưa học</span>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {['N5', 'N4', 'N3', 'N2', 'N1'].map(lvl => (
                                        <button key={`kanji-${lvl}`} onClick={() => loadRandomKanji(lvl)} className="py-2.5 border border-gray-200 bg-white text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white rounded-xl font-bold text-xs transition-all active:scale-95">{lvl}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Bộ thủ & Bảng chữ cái</label>
                               <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => fetchAndSetData('./data/bothu.json')} className="py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-all active:scale-95">Bộ thủ</button>
                                    <button onClick={() => fetchAndSetData('./data/hiragana.json')} disabled={isKanjiEssay} className={`py-2.5 border rounded-xl text-xs font-bold transition-all ${isKanjiEssay ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-50' : 'border-gray-200 text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white active:scale-95'}`}>Hiragana</button>
                                    <button onClick={() => fetchAndSetData('./data/katakana.json')} disabled={isKanjiEssay} className={`py-2.5 border rounded-xl text-xs font-bold transition-all ${isKanjiEssay ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-50' : 'border-gray-200 text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white active:scale-95'}`}>Katakana</button>
                                </div>
                            </div>
                            
                            <div className="border-t border-gray-100 pt-5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Lấy toàn bộ (Theo cấp độ)</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['N5', 'N4', 'N3', 'N2', 'N1'].map(lvl => (
                                        <button key={`all-${lvl}`} onClick={() => fetchAndSetData(`./data/kanji${lvl.toLowerCase()}.json`)} className="py-2.5 border border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-900 hover:bg-gray-900 hover:text-white rounded-xl font-bold text-xs transition-all active:scale-95">{lvl}</button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        // --- GIAO DIỆN THƯ VIỆN TỪ VỰNG ---
                        <div className="space-y-5">
                            {/* Minna */}
                            <div className="flex items-center justify-between group hover:bg-gray-50 p-2 rounded-xl transition-colors border border-transparent hover:border-gray-200">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Minna No Nihongo</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 font-bold text-[10px] uppercase">Bài</span>
                                    <input 
                                        type="number" 
                                        placeholder="..." 
                                        value={minnaLesson} 
                                        onChange={e => { setMinnaLesson(e.target.value); if(e.target.value) {setMimiPart(''); setTangoPart('');} }} 
                                        onBlur={validateMinnaLesson} 
                                        onKeyDown={(e) => { 
                                            if (e.key === 'Enter' && minnaLesson) {
                                                e.preventDefault();
                                                handleSmartLoadVocabulary();
                                            } 
                                        }}
                                        className="w-14 text-center font-bold border-b-2 border-gray-200 focus:border-gray-900 text-gray-900 outline-none bg-transparent transition-all text-base pb-0.5" 
                                    />
                                </div>
                            </div>

                            {/* Mimikara */}
                            <div className="flex items-center justify-between group hover:bg-gray-50 p-2 rounded-xl transition-colors border border-transparent hover:border-gray-200">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Mimikara</label>
                                <div className="flex items-center gap-2">
                                    <select 
                                        value={mimiLevel} 
                                        onChange={e => { 
                                            const newLevel = e.target.value;
                                            setMimiLevel(newLevel);
                                            if (mimiPart !== '') {
                                                const limits = { N3: 12, N2: 13, N1: 14 };
                                                if (parseInt(mimiPart) > limits[newLevel]) setMimiPart(limits[newLevel]);
                                            }
                                        }} 
                                        className="p-1 border border-gray-200 rounded text-xs font-bold text-gray-700 outline-none bg-white"
                                    >
                                        <option value="N3">N3</option><option value="N2">N2</option><option value="N1">N1</option>
                                    </select>
                                    <span className="text-gray-400 font-bold text-[10px] uppercase">Phần</span>
                                    <input 
                                        type="number" 
                                        placeholder="..." 
                                        value={mimiPart} 
                                        onChange={e => { setMimiPart(e.target.value); if(e.target.value) {setMinnaLesson(''); setTangoPart('');} }} 
                                        onBlur={validateMimiPart}
                                        onKeyDown={(e) => { 
                                            if (e.key === 'Enter' && mimiPart) {
                                                e.preventDefault();
                                                handleSmartLoadVocabulary();
                                            } 
                                        }}
                                        className="w-14 text-center font-bold border-b-2 border-gray-200 focus:border-gray-900 text-gray-900 outline-none bg-transparent transition-all text-base pb-0.5" 
                                    />
                                </div>
                            </div>

                            {/* Tango */}
                            <div className="flex items-center justify-between group hover:bg-gray-50 p-2 rounded-xl transition-colors border border-transparent hover:border-gray-200">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Tango</label>
                                <div className="flex items-center gap-2">
                                    <select 
                                        value={tangoLevel} 
                                        onChange={e => { 
                                            const newLevel = e.target.value;
                                            setTangoLevel(newLevel);
                                            if (tangoPart !== '') {
                                                const limits = { N3: 12, N2: 12, N1: 14 };
                                                if (parseInt(tangoPart) > limits[newLevel]) setTangoPart(limits[newLevel]);
                                            }
                                        }} 
                                        className="p-1 border border-gray-200 rounded text-xs font-bold text-gray-700 outline-none bg-white"
                                    >
                                        <option value="N3">N3</option><option value="N2">N2</option><option value="N1">N1</option>
                                    </select>
                                    <span className="text-gray-400 font-bold text-[10px] uppercase">Phần</span>
                                    <input 
                                        type="number" 
                                        placeholder="..." 
                                        value={tangoPart} 
                                        onChange={e => { setTangoPart(e.target.value); if(e.target.value) {setMinnaLesson(''); setMimiPart('');} }} 
                                        onBlur={validateTangoPart}
                                        onKeyDown={(e) => { 
                                            if (e.key === 'Enter' && tangoPart) {
                                                e.preventDefault();
                                                handleSmartLoadVocabulary();
                                            } 
                                        }}
                                        className="w-14 text-center font-bold border-b-2 border-gray-200 focus:border-gray-900 text-gray-900 outline-none bg-transparent transition-all text-base pb-0.5" 
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <button
                                    onClick={handleSmartLoadVocabulary}
                                    disabled={!minnaLesson && !mimiPart && !tangoPart}
                                    className={`w-full py-3.5 font-bold text-xs rounded-xl shadow-sm active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2 
                                        ${(!minnaLesson && !mimiPart && !tangoPart)
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-gray-900 hover:bg-black text-white'
                                        }`}
                                >
                                    TẢI DỮ LIỆU
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- 2. MODAL THIẾT LẬP BÀI HỌC (ĐÃ TINH GỌN VÀ GỌI LIBRARY MODAL) ---
const StudySetupModal = ({ 
    isOpen, onClose, onStart, targetAction, 
    config, onChange, mode, setPracticeMode, dbData, srsData,
    verbTargetForm, setVerbTargetForm,
    verbPracticeMode, setVerbPracticeMode, verbSelectedForms, setVerbSelectedForms 
}) => {
    const [localText, setLocalText] = useState(config.text);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false); // Quản lý mở Thư viện

    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [isFormDropdownOpen, setIsFormDropdownOpen] = useState(false);
    const formDropdownRef = useRef(null);
    const filterRef = useRef(null);
    const isComposing = useRef(false);

    const [filterOptions, setFilterOptions] = useState({
        hiragana: true, katakana: true, kanji: true, removeDuplicates: false 
    });
// --- 1. ĐỒNG BỘ DỮ LIỆU (Tách riêng để không ảnh hưởng khóa nền) ---
    useEffect(() => {
        if (isOpen) {
            setLocalText(config.text);
        }
    }, [isOpen, config.text]);

    // --- 2. FIX KHÓA NỀN CỐ ĐỊNH (Chỉ chạy khi bật/tắt Modal) ---
    useEffect(() => {
        if (isOpen) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
        } else {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = '';
            setIsFilterMenuOpen(false); // Reset menu lọc
            
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        }
    }, [isOpen]);
   useEffect(() => {
        function handleClickOutside(event) {
            if (filterRef.current && !filterRef.current.contains(event.target)) setIsFilterMenuOpen(false);
            if (formDropdownRef.current && !formDropdownRef.current.contains(event.target)) setIsFormDropdownOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isOpen) return null;

    // --- CÁC HÀM XỬ LÝ NHẬP LIỆU & BỘ LỌC CHUNG ---
    const getAllowedRegexString = (options, allowLatin = false) => {
        let ranges = "\\s;"; 
        if (allowLatin) ranges += "a-zA-Z"; 
        if (options.hiragana) ranges += "\\u3040-\\u309F";
        if (options.katakana) ranges += "\\u30A0-\\u30FF";
        if (options.kanji)    ranges += "\\u4E00-\\u9FAF\\u3400-\\u4DBF\\u2E80-\\u2FDF\\uF900-\\uFAFF\\u3005"; 
        return ranges;
    };

    const getUniqueChars = (str) => Array.from(new Set(str)).join('');

    const handleFilterChange = (key) => {
        const newOptions = { ...filterOptions, [key]: !filterOptions[key] };
        setFilterOptions(newOptions);
        let newText = localText;
        if (mode === 'kanji') {
            if (['hiragana', 'katakana', 'kanji'].includes(key) && filterOptions[key] === true) {
                const regex = new RegExp(`[^${getAllowedRegexString(newOptions, true)}]`, 'g');
                newText = newText.replace(regex, '');
            }
            if (newOptions.removeDuplicates) newText = getUniqueChars(newText);
        }
        setLocalText(newText); onChange({ ...config, text: newText.replace(/[a-zA-Z]/g, '') });
    };

    const handleInputText = (e) => {
        const rawInput = e.target.value;
        if (isComposing.current) return setLocalText(rawInput);
        let validForInput = rawInput;
        if (mode === 'kanji') {
            validForInput = rawInput.replace(new RegExp(`[^${getAllowedRegexString(filterOptions, true)}]`, 'g'), '');
            if (filterOptions.removeDuplicates) validForInput = getUniqueChars(validForInput);
        }
        setLocalText(validForInput); onChange({ ...config, text: validForInput.replace(/[a-zA-Z]/g, '') });
    };

    const handleCompositionStart = () => { isComposing.current = true; };
    const handleCompositionEnd = (e) => { isComposing.current = false; handleInputText(e); };

    const handleBlurText = () => {
        if (!localText) return;
        
        let cleaned = localText;

        if (mode === 'vocab') {
            // Chế độ TỪ VỰNG
            cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/(\n\s*){2,}/g, '\n').trim();
            const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            cleaned = [...new Set(lines)].join('\n');
            if (cleaned.length > 0) cleaned += '\n'; 
        } else {
            // Chế độ KANJI: Xóa SẠCH khoảng trắng, dấu xuống dòng
            cleaned = cleaned.replace(/[\s\u3000]+/g, '');
            cleaned = getUniqueChars(cleaned);
        }

        if (cleaned !== localText) {
            setLocalText(cleaned); 
            onChange({ ...config, text: cleaned.replace(/[a-zA-Z]/g, '') });
        }
    };

   const getDynamicPlaceholder = () => {
    // 1. Thêm điều kiện kiểm tra nếu đang ở tính năng Chia động từ
    if (targetAction === 'conjugate') {
        return "Phân cách bằng dấu xuống dòng\n(nhập thể masu và kèm kanji)\nvd: 食べます";
    }

    // 2. Các trường hợp còn lại (Từ vựng, Kanji) giữ nguyên
    if (mode === 'vocab') return "Nhập thủ công TỪ VỰNG\n(phân cách bằng dấu xuống dòng)";
    const labels = [];
    if (filterOptions.kanji) labels.push("漢字");        
    if (filterOptions.hiragana) labels.push("ひらがな"); 
    if (filterOptions.katakana) labels.push("カタカナ"); 
    if (labels.length === 0) return "Vui lòng chọn 1 loại chữ trong BỘ LỌC";
    return "Nhập thủ công\n" + labels.join("、");
};

    const handleShuffle = () => {
        if (!config.text) return;
        let newContent = "";
        if (mode === 'vocab') {
            const lines = config.text.split(/[\n;]+/).filter(line => line.trim() !== '');
            newContent = lines.sort(() => Math.random() - 0.5).join('\n');
        } else {
            newContent = [...config.text].sort(() => Math.random() - 0.5).join('');
        }
        setLocalText(newContent); onChange({ ...config, text: newContent });
    };

    return (
        <div className="fixed inset-0 z-[300] flex justify-center items-end sm:items-center bg-gray-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            
            {/* GỌI MODAL THƯ VIỆN Ở ĐÂY */}
            <LibraryModal 
                isOpen={isLibraryOpen}
                onClose={() => setIsLibraryOpen(false)}
                mode={mode}
                targetAction={targetAction}
                dbData={dbData}
                srsData={srsData}
                onSelectData={(newText) => {
                    setLocalText(newText);
                    onChange({ ...config, text: newText });
                }}
            />

            {/* BẢNG CHÍNH - GIAO DIỆN SETUP */}
            <div className="bg-white w-full max-w-lg sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
                
              {/* Header: Đổi chế độ */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50 relative">
                    {targetAction !== 'conjugate' ? (
                        <div className="flex bg-gray-200/50 p-1 rounded-xl border border-gray-200">
                            <button onClick={() => setPracticeMode('kanji')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'kanji' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}>KANJI</button>
                            <button onClick={() => setPracticeMode('vocab')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'vocab' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}>TỪ VỰNG</button>
                        </div>
                    ) : (
                        <div className="flex bg-gray-200/50 p-1 rounded-xl border border-gray-200 max-w-[calc(100%-40px)] overflow-x-auto custom-scrollbar no-scrollbar">
                            <button onClick={() => setVerbPracticeMode('essay')} className={`flex-shrink-0 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${verbPracticeMode === 'essay' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500'}`}>TỰ LUẬN</button>
                            <button onClick={() => setVerbPracticeMode('quiz')} className={`flex-shrink-0 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${verbPracticeMode === 'quiz' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500'}`}>TRẮC NGHIỆM</button>
                            <button onClick={() => setVerbPracticeMode('reflex')} className={`flex-shrink-0 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${verbPracticeMode === 'reflex' ? 'bg-white text-red-600 shadow-sm border border-red-200' : 'text-gray-500'}`}>⚡ PHẢN XẠ</button>
                        </div>
                    )}
                    
                    {/* Nút đóng X - Cố định vị trí và chỉ giữ 1 nút duy nhất */}
                    <button onClick={onClose} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm ml-2">✕</button>
                </div>
                        
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-5 relative">
                    {/* Thêm phần chọn Thể nếu đang là chế độ Conjugate */}
{/* Thêm phần chọn Thể với UI Dropdown Custom */}
{targetAction === 'conjugate' && (
    <div className="mb-6 relative z-[60]" ref={formDropdownRef}>
        
        {/* NẾU LÀ TỰ LUẬN: BẢNG CHỌN DROPDOWN */}
        {verbPracticeMode === 'essay' && (
            <>
                <button 
                    onClick={() => setIsFormDropdownOpen(!isFormDropdownOpen)}
                    className={`w-full p-4 bg-white border-2 hover:border-indigo-300 rounded-2xl flex justify-between items-center transition-all shadow-sm group ${verbTargetForm ? 'border-indigo-100' : 'border-red-200'}`}
                >
                    <div className="flex flex-col items-start text-left">
                        <span className="text-indigo-700 font-bold flex items-center gap-2">
                            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                            {/* HIỆN TÊN THỂ HOẶC CHỮ MẶC ĐỊNH */}
                            {[
                                { id: "Te", label: "Thể Te" }, { id: "Ta", label: "Thể Ta" }, { id: "Nai", label: "Thể Nai" },
                                { id: "Dictionary", label: "Thể Từ Điển" }, { id: "Ba", label: "Thể Điều Kiện" }, { id: "Volitional", label: "Thể Ý Chí" },
                                { id: "Imperative", label: "Thể Mệnh Lệnh" }, { id: "Prohibitive", label: "Thể Cấm Chỉ" }, { id: "Potential", label: "Thể Khả Năng" },
                                { id: "Passive", label: "Thể Bị Động" }, { id: "Causative", label: "Thể Sai Khiến" }, 
                                { id: "CausativePassive", label: "Bị Động Sai Khiến" }
                            ].find(opt => opt.id === verbTargetForm)?.label || 'Chọn thể động từ...'}
                        </span>
                        
                        {/* CHỈ HIỆN CHÚ Ý KHI ĐANG MỞ VÀ CHƯA CHỌN */}
                        {isFormDropdownOpen && !verbTargetForm && (
                            <span className="text-[10px] mt-1.5 text-red-500 font-bold">
                                * Vui lòng chọn 1 thể để bắt đầu
                            </span>
                        )}
                    </div>
                    <svg className={`w-5 h-5 transition-transform duration-300 flex-shrink-0 ${verbTargetForm ? 'text-indigo-400' : 'text-red-400'} ${isFormDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {isFormDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-[0_10px_40px_rgb(0,0,0,0.1)] max-h-56 overflow-y-auto custom-scrollbar p-2 animate-in fade-in zoom-in-95 duration-200 z-[100]">
                        {[
                            { id: "Te", label: "Thể Te" }, { id: "Ta", label: "Thể Ta" }, { id: "Nai", label: "Thể Nai" },
                            { id: "Dictionary", label: "Thể Từ Điển" }, { id: "Ba", label: "Thể Điều Kiện" }, { id: "Volitional", label: "Thể Ý Chí" },
                            { id: "Imperative", label: "Thể Mệnh Lệnh" }, { id: "Prohibitive", label: "Thể Cấm Chỉ" }, { id: "Potential", label: "Thể Khả Năng" },
                            { id: "Passive", label: "Thể Bị Động" }, { id: "Causative", label: "Thể Sai Khiến" }, 
                            { id: "CausativePassive", label: "Bị Động Sai Khiến" }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => {
                                    setVerbTargetForm(opt.id);
                                    setIsFormDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${verbTargetForm === opt.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                            >
                                {opt.label}
                                {verbTargetForm === opt.id && (
                                    <svg className="w-5 h-5 text-indigo-600 animate-in zoom-in" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </>
        )}

      {/* NẾU LÀ TRẮC NGHIỆM / PHẢN XẠ: MULTI-SELECT CHỌN NHIỀU THỂ */}
        {(verbPracticeMode === 'quiz' || verbPracticeMode === 'reflex') && (
            <div className="relative">
                {/* Nút bấm để mở Dropdown */}
                <button 
                    onClick={() => setIsFormDropdownOpen(!isFormDropdownOpen)}
                    className={`w-full p-4 bg-white border-2 hover:border-indigo-300 rounded-2xl flex justify-between items-center transition-all shadow-sm group ${verbSelectedForms.length >= (verbPracticeMode === 'reflex' ? 5 : 4) ? 'border-indigo-100' : 'border-red-200'}`}
                >
                    <div className="flex flex-col items-start text-left">
                        <span className="text-indigo-700 font-bold flex items-center gap-2">
                            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                            {verbSelectedForms.length === 0 
                                ? "Chọn thể động từ..." 
                                : `Đã chọn ${verbSelectedForms.length} thể động từ`}
                        </span>
                        
                        {/* CHỈ HIỆN CHÚ Ý KHI ĐANG MỞ BẢNG VÀ CHƯA CHỌN ĐỦ */}
{isFormDropdownOpen && verbSelectedForms.length < (verbPracticeMode === 'reflex' ? 5 : 4) && (
    <span className="text-[10px] mt-1.5 text-red-500 font-bold">
        * Chú ý: Cần chọn tối thiểu {verbPracticeMode === 'reflex' ? 5 : 4} thể
    </span>
)}
                    </div>

                    <svg className={`w-5 h-5 transition-transform duration-300 flex-shrink-0 ${verbSelectedForms.length >= (verbPracticeMode === 'reflex' ? 5 : 4) ? 'text-indigo-400' : 'text-red-400'} ${isFormDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {/* Khung Dropdown Danh sách 12 Thể */}
                {isFormDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] p-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: "Te", name: "Thể Te" }, { id: "Ta", name: "Thể Ta" }, { id: "Nai", name: "Thể Nai" },
                                { id: "Dictionary", name: "Từ Điển" }, { id: "Ba", name: "Điều Kiện" }, { id: "Volitional", name: "Ý Chí" },
                                { id: "Imperative", name: "Mệnh Lệnh" }, { id: "Prohibitive", name: "Cấm Chỉ" }, { id: "Potential", name: "Khả Năng" },
                                { id: "Passive", name: "Bị Động" }, { id: "Causative", name: "Sai Khiến" }, { id: "CausativePassive", name: "Bị Sai Khiến" }
                            ].map(opt => {
                                const isSelected = verbSelectedForms.includes(opt.id);
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isSelected) setVerbSelectedForms(prev => prev.filter(f => f !== opt.id));
                                            else setVerbSelectedForms(prev => [...prev, opt.id]);
                                        }}
                                        className={`px-1 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all border-2 active:scale-95 flex items-center justify-center text-center leading-tight ${
                                            isSelected 
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200' 
                                            : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                                        }`}
                                    >
                                        {opt.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
)}
                   {/* Thanh tìm kiếm (Ẩn khi ở chế độ chia động từ) */}
{targetAction !== 'conjugate' && (
    <SearchBar 
        mode={mode} dbData={dbData} 
        onSelectResult={(item) => {
            let newText = mode === 'vocab' 
                ? [...new Set((config.text + (config.text && !config.text.endsWith('\n') ? '\n' : '') + item.char + '\n').split('\n').map(l=>l.trim()).filter(l=>l))].join('\n') + '\n'
                : Array.from(new Set(config.text + item.char)).join('');
            setLocalText(newText); onChange({ ...config, text: newText });
        }} 
        onSelectAll={(items) => {
            let newText = [...new Set((localText + (localText && !localText.endsWith('\n') ? '\n' : '') + items.map(item => item.char).join('\n') + '\n').split('\n').map(l=>l.trim()).filter(l=>l))].join('\n') + '\n';
            setLocalText(newText); onChange({ ...config, text: newText });
        }} 
    />
)}

                    {/* Textarea Nhập liệu */}
                    <div className="relative">
                        <textarea 
                            value={localText} onChange={handleInputText} onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd} onBlur={handleBlurText}
                            placeholder={getDynamicPlaceholder()} 
                            className="w-full h-[120px] p-4 bg-gray-50 border border-gray-200 rounded-2xl resize-none text-[18px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:bg-white transition-all leading-relaxed [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" 
                            style={{ fontFamily: "system-ui, -apple-system, sans-serif, 'Klee One'" }}
                        />
                        {localText && (
                            <button onClick={() => { setLocalText(''); onChange({ ...config, text: '' }); }} className="absolute bottom-4 right-4 text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm transition-colors">Xóa hết</button>
                        )}
                    </div>

                    {/* Tiện ích (Thư viện, Xáo trộn, BỘ LỌC) */}
    <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setIsLibraryOpen(true)} className="flex items-center justify-center py-4 rounded-2xl bg-white border border-gray-200 hover:border-gray-900 hover:shadow-md text-gray-700 transition-all group">
            <span className="text-sm font-bold uppercase tracking-widest">Thư viện</span>
        </button>
        
        <button onClick={handleShuffle} className="flex items-center justify-center py-4 rounded-2xl bg-white border border-gray-200 hover:border-gray-900 hover:shadow-md text-gray-700 transition-all group">
            <span className="text-sm font-bold uppercase tracking-widest">Xáo trộn</span>
        </button>
        
        <div className="relative" ref={filterRef}>
            <button disabled={mode === 'vocab'} onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)} className={`w-full flex items-center justify-center py-4 rounded-2xl border transition-all group ${mode === 'vocab' ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-70' : isFilterMenuOpen ? 'bg-gray-100 border-gray-900 text-gray-900' : 'bg-white border-gray-200 hover:border-gray-900 hover:shadow-md text-gray-700'}`}>
                <span className="text-sm font-bold uppercase tracking-widest">Bộ lọc</span>
            </button>

                            {isFilterMenuOpen && mode !== 'vocab' && (
                                <div className="absolute bottom-full right-0 mb-3 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 text-left">
                                    <div className="mb-3 pb-2 border-b border-gray-100">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cho phép nhập</span>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 text-xs font-bold text-gray-700 cursor-pointer hover:text-black">
                                            <input type="checkbox" checked={filterOptions.kanji} onChange={() => handleFilterChange('kanji')} className="accent-gray-900 w-4 h-4 rounded-sm"/> Kanji & Bộ thủ
                                        </label>
                                        <label className="flex items-center gap-3 text-xs font-bold text-gray-700 cursor-pointer hover:text-black">
                                            <input type="checkbox" checked={filterOptions.hiragana} onChange={() => handleFilterChange('hiragana')} className="accent-gray-900 w-4 h-4 rounded-sm"/> Hiragana
                                        </label>
                                        <label className="flex items-center gap-3 text-xs font-bold text-gray-700 cursor-pointer hover:text-black">
                                            <input type="checkbox" checked={filterOptions.katakana} onChange={() => handleFilterChange('katakana')} className="accent-gray-900 w-4 h-4 rounded-sm"/> Katakana
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

               {/* Footer: Nút Tiếp Tục */}
                <div className="p-5 border-t border-gray-100 bg-white">
                   <button 
                        onClick={() => {
                            let finalContent = localText || "";
                            finalContent = finalContent.replace(/[ \t]+/g, ' ').replace(/(\n\s*){2,}/g, '\n').trim();
                            
                            if (mode === 'vocab') {
                                const lines = finalContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                                finalContent = [...new Set(lines)].join('\n');
                            } else { 
                                finalContent = getUniqueChars(finalContent); 
                            }

                            let cleanLatinh = finalContent.replace(/[a-zA-Z]/g, '');

                            // ==========================================
                            //  KIỂM TRA ĐIỀU KIỆN CHIA ĐỘNG TỪ
                            // ==========================================
                            if (targetAction === 'conjugate') {
        // 1. Kiểm tra Tự luận chưa chọn thể
        if (verbPracticeMode === 'essay' && !verbTargetForm) {
            alert("Vui lòng chọn 1 thể động từ để luyện tập!");
            return;
        }
                                const minForms = verbPracticeMode === 'reflex' ? 5 : 4;
                                
                                // 1. Kiểm tra số lượng THỂ
                                if ((verbPracticeMode === 'quiz' || verbPracticeMode === 'reflex') && verbSelectedForms.length < minForms) {
                                    alert(`Vui lòng chọn ít nhất ${minForms} thể động từ cho chế độ này!`);
                                    return;
                                }

                                // 2. Kiểm tra số lượng ĐỘNG TỪ (Chỉ áp dụng cho Phản xạ)
                                if (verbPracticeMode === 'reflex') {
                                    // Đếm số dòng (mỗi dòng là 1 động từ)
                                    const verbCount = cleanLatinh.split('\n').map(l => l.trim()).filter(l => l.length > 0).length;
                                    if (verbCount < 10) {
                                        alert(`⚡ Chế độ Phản Xạ yêu cầu nhập ít nhất 10 động từ.\nBạn mới nhập ${verbCount} từ.`);
                                        return;
                                    }
                                }
                            }
                            
                            // XỬ LÝ LỌC KANA CHO TỰ LUẬN KANJI
                            if (mode === 'kanji' && targetAction === 'essay') {
                                const kanaRegex = /[\u3040-\u309F\u30A0-\u30FF]/g;
                                const hasKana = kanaRegex.test(cleanLatinh);
                                const onlyKanji = cleanLatinh.replace(kanaRegex, '');

                                if (hasKana) {
                                    if (onlyKanji.trim().length === 0) {
                                        alert("Chế độ Tự Luận không hỗ trợ kiểm tra Bảng chữ cái.\nVui lòng nhập Kanji!");
                                        return; 
                                    } else {
                                        cleanLatinh = onlyKanji;
                                    }
                                }
                            }
                            // ==========================================

                            setLocalText(cleanLatinh); 
                            onChange({ ...config, text: cleanLatinh });

                            if (!cleanLatinh || cleanLatinh.trim().length === 0) return alert("Bạn chưa nhập dữ liệu để học!");
                            
                            // VƯỢT QUA HẾT ĐIỀU KIỆN THÌ VÀO PREVIEW
                            onStart('preview'); 
                        }}
                        className="w-full py-4 bg-gray-900 hover:bg-black text-white font-black rounded-2xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-widest flex justify-center items-center gap-2"
                    >
                        TIẾP TỤC
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
const VerbPreviewListModal = ({ isOpen, onClose, onStart, text, dbData, targetForm, onUpdateText, globalVerbReadings, setGlobalVerbReadings, verbPracticeMode }) => {
    const [parsedVerbs, setParsedVerbs] = React.useState([]);
    const [tempReadings, setTempReadings] = React.useState({}); 
    const [fixingVerbs, setFixingVerbs] = React.useState({}); 
    const [editingValidVerb, setEditingValidVerb] = React.useState(null);

    const formLabels = { 
        "Te": "Thể Te", "Ta": "Thể Ta", "Nai": "Thể Nai", 
        "Dictionary": "Thể Từ Điển", "Ba": "Thể Điều Kiện",
        "Volitional": "Thể Ý Chí", "Imperative": "Thể Mệnh Lệnh",
        "Potential": "Thể Khả Năng", "Passive": "Thể Bị Động",
        "Causative": "Thể Sai Khiến", "CausativePassive": "Bị Động Sai Khiến", "Prohibitive": "Thể Cấm Chỉ"
    };
React.useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);
    React.useEffect(() => {
        if (!isOpen) return;
        const lines = Array.from(new Set(text.split(/[\n;]+/).map(w => w.trim()).filter(w => w)));
        let results = lines.map(line => {
            const parsed = VerbEngine.parseVmasu(line, dbData);
            if (!parsed || parsed.error) return { vmasu: line, error: parsed?.error || "Đuôi động từ không hợp lệ (Phải là ~ます)" };
            const dbInfo = dbData?.TUVUNG_DB?.[parsed.vru];
            let reading = "";
            if (dbInfo && dbInfo.reading) reading = VerbEngine.deriveMasuReading(dbInfo.reading, parsed.group);
            return { ...parsed, reading };
        });

        // --- THÊM LOGIC SẮP XẾP TẠI ĐÂY ---
        results.sort((a, b) => {
            const getPriority = (item) => {
                if (item.error) return 1; // Mức ưu tiên 1: Từ bị lỗi -> Lên trên cùng
                const hasReading = item.reading || globalVerbReadings[item.vmasu];
                if (!hasReading) return 2; // Mức ưu tiên 2: Từ thiếu Hiragana -> Ở giữa
                return 3; // Mức ưu tiên 3: Từ đã Sẵn sàng -> Đẩy xuống cuối
            };
            return getPriority(a) - getPriority(b);
        });

        setParsedVerbs(results);
   
    }, [isOpen, text, dbData, globalVerbReadings]); 

    if (!isOpen) return null;

    const hasErrors = parsedVerbs.some(v => v.error);
    const missingReadings = parsedVerbs.filter(v => !v.error && (!v.reading && !globalVerbReadings[v.vmasu]));
    const canStart = !hasErrors && missingReadings.length === 0;

    const handleStart = () => {
        const finalData = parsedVerbs.map(v => ({
            ...v,
            finalReading: v.reading || globalVerbReadings[v.vmasu]
        }));
        onStart(finalData, targetForm);
    };

    const handleFixVmasu = (oldWord, newWord) => {
        if (!newWord || !newWord.trim()) return;
        let words = text.split(/[\n;]+/).map(w => w.trim()).filter(w => w);
        words = words.map(w => w === oldWord ? newWord.trim() : w);
        if (onUpdateText) {
            onUpdateText(words.join('\n') + '\n');
        }
        setFixingVerbs(prev => {
            const next = {...prev};
            delete next[oldWord];
            return next;
        });
        setEditingValidVerb(null);
    };
// --- THÊM HÀM XÓA TỪ KHỎI DANH SÁCH ---
    const handleRemoveVerb = (wordToRemove) => {
        // Lọc bỏ từ cần xóa
        let words = text.split(/[\n;]+/).map(w => w.trim()).filter(w => w && w !== wordToRemove);
        if (onUpdateText) {
            onUpdateText(words.join('\n') + (words.length > 0 ? '\n' : ''));
        }
        // Dọn dẹp rác trong state (nếu có)
        setFixingVerbs(prev => { const next = {...prev}; delete next[wordToRemove]; return next; });
        setTempReadings(prev => { const next = {...prev}; delete next[wordToRemove]; return next; });
        setGlobalVerbReadings(prev => { const next = {...prev}; delete next[wordToRemove]; return next; });
    };
    const handleSaveReading = (vmasu) => {
        const val = tempReadings[vmasu];
        if (val && val.trim() !== '') {
            const cleanVal = val.trim();

            // 1. Kiểm tra nếu người dùng nhập Kanji
            if (/[\u4E00-\u9FAF]/.test(cleanVal)) {
                alert("Vui lòng CHỈ NHẬP HIRAGANA, không nhập Kanji vào ô này!");
                return; // Chặn lại, không cho lưu
            }

            // 2. Kiểm tra nếu không kết thúc bằng ます
            if (!cleanVal.endsWith("ます")) {
                alert("Vui lòng nhập đúng thể V-masu (phải có đuôi ~ます)!\nVí dụ: たべます");
                return; // Chặn lại, không cho lưu
            }

            // Nếu đúng chuẩn thì mới cho lưu
            setGlobalVerbReadings(prev => ({...prev, [vmasu]: cleanVal}));
            setTempReadings(prev => {
                const next = {...prev};
                delete next[vmasu];
                return next;
            });
        }
    };

    const handleEditReading = (vmasu) => {
       
        setTempReadings(prev => ({...prev, [vmasu]: globalVerbReadings[vmasu]}));
    };

    return (
        <div className="fixed inset-0 z-[400] flex justify-center items-center bg-gray-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Chuẩn bị chia động từ</h2>
                        <p className="text-xs text-gray-500 font-medium">Bổ sung Hiragana hoặc sửa lỗi nếu hệ thống không tìm thấy</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500">✕</button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                    {parsedVerbs.map((item, idx) => {
                        const currentReading = item.reading || globalVerbReadings[item.vmasu];
                        
                        // CHỈ CHIA THỂ KHI LÀ TỰ LUẬN
                        let conjugatedResult = "...";
                        if (currentReading && verbPracticeMode === 'essay') {
                            conjugatedResult = VerbEngine.conjugate(currentReading, item, targetForm);
                            if (conjugatedResult.includes(" / ")) {
                                conjugatedResult = conjugatedResult.split(" / ")[0];
                            }
                        }

                        return (
                            <div key={idx} className={`p-4 rounded-xl border-2 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${item.error ? 'border-red-200 bg-red-50' : (!currentReading) ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-gray-100 bg-white'}`}>
                                <div className="flex flex-col w-full">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xl font-bold ${item.error ? 'text-red-700 line-through opacity-60' : 'text-gray-900'}`}>{item.vmasu}</span>
                                        {!item.error && (
                                            <span className="px-2 py-0.5 bg-gray-900 text-white text-[10px] font-black rounded uppercase">Nhóm {item.group}</span>
                                        )}
                                    </div>

                                    {item.error ? (
                                        <div className="flex flex-col gap-2 mt-2 w-full">
                                            <span className="text-xs text-red-600 font-medium">{item.error}</span>
                                            <div className="flex gap-2 w-full sm:w-84">
                                                <input 
                                                    type="text" 
                                                    placeholder="Sửa thành thể Masu..."
                                                    value={fixingVerbs[item.vmasu] !== undefined ? fixingVerbs[item.vmasu] : item.vmasu}
                                                    onChange={(e) => setFixingVerbs({...fixingVerbs, [item.vmasu]: e.target.value})}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleFixVmasu(item.vmasu, fixingVerbs[item.vmasu] || item.vmasu)}
                                                    className="flex-1 p-2 border-2 border-red-300 rounded-lg text-[16px] outline-none focus:border-red-500 font-bold text-gray-900 bg-white min-w-0"
                                                />
                                                <button 
                                                    onClick={() => handleFixVmasu(item.vmasu, fixingVerbs[item.vmasu] || item.vmasu)}
                                                    className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 active:scale-95 transition-all flex-shrink-0"
                                                >
                                                    LƯU
                                                </button>
                                                {/* NÚT XÓA TỪ */}
                                                <button 
                                                    onClick={() => handleRemoveVerb(item.vmasu)}
                                                    className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors flex-shrink-0 active:scale-95"
                                                    title="Loại bỏ từ này"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* CHỈ HIỆN KHI LÀ TỰ LUẬN */
                                        verbPracticeMode === 'essay' && (
                                            <span className="text-[12px] text-gray-500 font-medium mt-1 flex items-center gap-1.5">
                                                {formLabels[targetForm] || targetForm}: 
                                                <strong className="text-indigo-600 font-bold text-[14px]">
                                                    {conjugatedResult}
                                                </strong>
                                            </span>
                                        )
                                    )}
                                </div>

                                {!item.error && (
                                    <div className="w-full sm:w-auto flex-shrink-0 flex items-center justify-end">
                                        {currentReading && tempReadings[item.vmasu] === undefined ? (
                                            editingValidVerb === item.vmasu ? (
                                                // --- FORM NHẬP TỪ MỚI KHI BẤM VÀO CÁI BÚT ---
                                                <div className="flex gap-2 w-full sm:w-64">
                                                    <input 
                                                        type="text" 
                                                        autoFocus
                                                        placeholder="Sửa từ vựng..." 
                                                        value={fixingVerbs[item.vmasu] !== undefined ? fixingVerbs[item.vmasu] : item.vmasu}
                                                        onChange={(e) => setFixingVerbs({...fixingVerbs, [item.vmasu]: e.target.value})}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleFixVmasu(item.vmasu, fixingVerbs[item.vmasu] || item.vmasu)}
                                                        className="flex-1 p-2 border-2 border-gray-300 focus:border-gray-900 rounded-lg outline-none font-bold text-gray-900 bg-white min-w-0 text-[16px]"
                                                    />
                                                    <button 
                                                        onClick={() => handleFixVmasu(item.vmasu, fixingVerbs[item.vmasu] || item.vmasu)}
                                                        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black active:scale-95 transition-all flex-shrink-0"
                                                    >
                                                        LƯU
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {item.reading && (
                                                        <button 
                                                            onClick={() => {
                                                                setEditingValidVerb(item.vmasu);
                                                                setFixingVerbs({...fixingVerbs, [item.vmasu]: item.vmasu});
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors shadow-sm"
                                                            title="Đổi từ vựng khác"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                                        </button>
                                                    )}

                                                    {!item.reading && globalVerbReadings[item.vmasu] && (
                                                        <button 
                                                            onClick={() => handleEditReading(item.vmasu)}
                                                            className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors shadow-sm"
                                                            title="Sửa cách đọc Hiragana"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        ) : (
                                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                                <label className="text-[10px] font-bold text-amber-600 uppercase">Nhập Hiragana V-masu</label>
                                                <div className="flex gap-2 w-full sm:w-72">
                                                    <input 
                                                        type="text" 
                                                        placeholder="VD: たべます" 
                                                        value={tempReadings[item.vmasu] !== undefined ? tempReadings[item.vmasu] : ''}
                                                        onChange={(e) => setTempReadings(prev => ({...prev, [item.vmasu]: e.target.value}))}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveReading(item.vmasu)}
                                                        className="flex-1 p-2 border-2 border-amber-300 focus:border-amber-500 rounded-lg outline-none font-bold text-gray-900 bg-white min-w-0 text-[16px]"
                                                    />
                                                    <button 
                                                        onClick={() => handleSaveReading(item.vmasu)}
                                                        className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 active:scale-95 transition-all flex-shrink-0"
                                                    >
                                                        LƯU
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="p-5 border-t border-gray-200 bg-gray-50 flex gap-3">
                    <button onClick={onClose} className="px-6 py-4 rounded-xl border border-gray-300 text-gray-600 font-bold text-xs uppercase hover:bg-gray-100">Quay lại</button>
                    <button 
                        onClick={handleStart} 
                        disabled={!canStart} 
                        className={`flex-1 py-4 font-black rounded-xl shadow-lg transition-all uppercase tracking-widest flex justify-center items-center gap-2 ${canStart ? 'bg-gray-900 hover:bg-black text-white active:scale-[0.98]' : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'}`}
                    >
                        {verbPracticeMode === 'quiz' ? 'VÀO TRẮC NGHIỆM' : verbPracticeMode === 'reflex' ? 'VÀO PHẢN XẠ' : 'VÀO TỰ LUẬN'}
                    </button>
                </div>
            </div>
        </div>
    );
};
const VerbEssayGameModal = ({ isOpen, onClose, verbsData, targetForm }) => {
    const [queue, setQueue] = React.useState([]);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [userInput, setUserInput] = React.useState('');
    const [status, setStatus] = React.useState('idle'); 
    const [finished, setFinished] = React.useState(false);
    const [correctAnswer, setCorrectAnswer] = React.useState('');
    const [initialTotal, setInitialTotal] = React.useState(0); 
    const [correctFirstTimeCount, setCorrectFirstTimeCount] = React.useState(0);
    const [wrongDetected, setWrongDetected] = React.useState(false);

    const formLabels = { 
        "Te": "Thể Te", "Ta": "Thể Ta", "Nai": "Thể Nai", 
        "Dictionary": "Thể Từ Điển", "Ba": "Thể Điều Kiện",
        "Volitional": "Thể Ý Chí", "Imperative": "Thể Mệnh Lệnh",
        "Potential": "Thể Khả Năng", "Passive": "Thể Bị Động",
        "Causative": "Thể Sai Khiến", "CausativePassive": "Bị Động Sai Khiến", "Prohibitive": "Thể Cấm Chỉ"
    };

    // --- KHỞI TẠO BÀI HỌC GIỐNG HỆT TỰ LUẬN TỪ VỰNG ---
    const initLesson = React.useCallback(() => {
        if (!verbsData || verbsData.length === 0) return;
        
        setFinished(false); 
        setCurrentIndex(0);
        setUserInput('');
        setStatus('idle');
        setCorrectFirstTimeCount(0);
        setWrongDetected(false);
        setCorrectAnswer('');

        const shuffled = [...verbsData].sort(() => Math.random() - 0.5);
        setQueue(shuffled);
        setInitialTotal(shuffled.length);
    }, [verbsData]);

    React.useEffect(() => {
        let rafId;
        if (isOpen) {
            // Dùng requestAnimationFrame thay vì setTimeout để đảm bảo mượt mà tuyệt đối
            rafId = requestAnimationFrame(() => {
                document.body.style.overflow = 'hidden';
            });
            initLesson();
        } else {
            document.body.style.overflow = 'unset';
            setFinished(false);
        }
        
        // Hàm dọn dẹp
        return () => { 
            if (rafId) cancelAnimationFrame(rafId);
            document.body.style.overflow = 'unset'; 
        };
    }, [isOpen, initLesson]);

    const triggerConfetti = React.useCallback(() => {
        if (typeof confetti === 'undefined') return;
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 2000 });
    }, []);

    React.useEffect(() => { if (finished && isOpen) triggerConfetti(); }, [finished, isOpen, triggerConfetti]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setUserInput(convertToKana(val, false)); 
    };

    const checkAnswer = () => {
        if (status === 'correct' || finished) return;
        const currentItem = queue[currentIndex];
        let finalInput = userInput.trim();

        if (finalInput.endsWith('n')) {
            finalInput = finalInput.slice(0, -1) + 'ん';
        }

        // 1. Tạo tập đáp án thuần HIRAGANA (Dùng để chấm điểm VÀ hiển thị khi sai)
        const kanaConjugation = VerbEngine.conjugate(currentItem.finalReading, currentItem, targetForm);
        const kanaAnswers = kanaConjugation.split(" / ");

        // 2. Tạo tập đáp án chứa KANJI (Chỉ dùng để chấm điểm, cho phép user nhập Kanji)
        const kanjiConjugation = VerbEngine.conjugate(currentItem.vmasu, currentItem, targetForm);
        const kanjiAnswers = kanjiConjugation.split(" / ");

        // 3. Gộp cả Kana và Kanji vào danh sách các đáp án được chấp nhận
        let baseAcceptableAnswers = [...kanaAnswers, ...kanjiAnswers];
        let acceptableAnswers = [...baseAcceptableAnswers];

        // 4. Mở rộng đáp án: Cho phép nhập thêm đuôi ~ます với các thể kết thúc bằng る
        if (["Potential", "Passive", "Causative", "CausativePassive"].includes(targetForm)) {
            // Lấy tất cả đáp án (cả Kanji lẫn Kana) bỏ chữ 'る' và thêm 'ます'
            const politeForms = baseAcceptableAnswers.map(ans => ans.slice(0, -1) + 'ます');
            acceptableAnswers = [...acceptableAnswers, ...politeForms];
        }

        // Kiểm tra xem input của user có nằm trong tập đáp án được chấp nhận không
        const isCorrect = acceptableAnswers.includes(finalInput);

        if (status === 'retyping' || status === 'wrong') {
            if (isCorrect) goToNext();
            else { setStatus('wrong'); setTimeout(() => setStatus('retyping'), 400); }
            return;
        }

        if (isCorrect) {
            setStatus('correct');
            if (!wrongDetected) setCorrectFirstTimeCount(prev => prev + 1);
            setTimeout(() => goToNext(), 600);
        } else {
            // 5. XỬ LÝ HIỂN THỊ KHI SAI: Chỉ lấy mảng kanaAnswers để show ra màn hình
            const displayAnswer = kanaAnswers.length > 1 
                ? `${kanaAnswers[0]} / ${kanaAnswers[1]}` 
                : kanaAnswers[0];
                
            setCorrectAnswer(displayAnswer); 
            setStatus('wrong');
            setWrongDetected(true);
            setQueue(prev => [...prev, currentItem]);
            setTimeout(() => setStatus('retyping'), 500);
        }
    };

    const goToNext = () => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserInput('');
            setStatus('idle');
            setCorrectAnswer('');
            setWrongDetected(false);
        } else { setFinished(true); }
    };

    if (!isOpen || queue.length === 0) return null;
    const currentItem = queue[currentIndex];
    const progressVisual = (correctFirstTimeCount / initialTotal) * 100;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-zinc-900/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
            {!finished ? (
               <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 flex flex-col items-center border-4 border-zinc-100 relative">
                    
                    {/* NHÃN TÊN THỂ HIỂN THỊ TRÊN CÙNG */}
<div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest px-5 h-8 rounded-full shadow-md whitespace-nowrap flex items-center justify-center leading-none border-[3px] border-white">
    {formLabels[targetForm] || targetForm}
</div>
                    <div className="w-full mb-8 mt-2">
                        <div className="flex justify-between items-center mb-5">
                            <span className="text-[11px] font-black text-zinc-900 bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200/50 shadow-sm">
                                {correctFirstTimeCount} / {initialTotal}
                            </span>
                            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-50 border border-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-90 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div className="h-full bg-zinc-900 transition-all duration-500" style={{ width: `${progressVisual}%` }}></div>
                        </div>
                    </div>

                   <div className={`flex flex-col items-center text-center mb-10 w-full transition-all duration-300 ${status === 'correct' ? 'scale-110 opacity-50' : status === 'wrong' ? 'animate-shake' : ''}`}>
                        <h2 className="text-5xl font-bold font-sans text-zinc-800 mb-3">
                            {currentItem.vmasu}
                        </h2>
                        {/* HIỂN THỊ HIRAGANA (Ẩn đi nếu từ gốc đã là Hiragana hoàn toàn) */}
                        {currentItem.finalReading && currentItem.finalReading !== currentItem.vmasu && (
                            <span className="text-lg font-bold text-indigo-600 tracking-widest bg-indigo-50 px-4 py-1 rounded-lg">
                                {currentItem.finalReading}
                            </span>
                        )}
                    </div>

                    <div className="w-full space-y-4">
                        <input 
                            type="text" autoFocus value={userInput} onChange={handleInputChange}
                            onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                            placeholder={status === 'retyping' ? "Gõ lại chính xác..." : "Nhập cách đọc..."}
                            className={`w-full p-4 text-center text-xl font-bold border-2 rounded-2xl outline-none transition-all ${status === 'correct' ? 'border-green-500 bg-green-50 text-green-700' : status === 'wrong' || status === 'retyping' ? 'border-red-500 bg-red-50 text-red-700' : 'border-zinc-100 focus:border-zinc-900 bg-zinc-50 shadow-inner'}`}
                        />
                        {(status === 'retyping' || status === 'wrong') && (
                            <div className="animate-in slide-in-from-top-2 duration-300 text-center">
                                <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Đáp án đúng:</p>
                                <div className="inline-block px-5 py-2.5 bg-red-600 text-white rounded-xl font-black text-lg shadow-lg shadow-red-200">{correctAnswer}</div>
                            </div>
                        )}
                        <p className="text-[9px] text-zinc-300 text-center font-bold uppercase tracking-widest pt-2">
                            {status === 'retyping' ? 'Bắt buộc gõ lại từ bị sai' : 'Nhấn Enter để kiểm tra'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] p-8 w-full max-w-[280px] text-center shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95">
                    <div className="text-5xl mb-4 animate-bounce cursor-pointer hover:scale-125 transition-transform" onClick={triggerConfetti}>🎉</div>
                    <h3 className="text-lg font-black text-gray-800 mb-1 uppercase">XUẤT SẮC!</h3>
                    <p className="text-gray-400 mb-6 text-[11px] font-medium italic">Bạn đã hoàn thành bài thi tự luận.</p>
                    <div className="space-y-2">
                        <button onClick={() => initLesson()} className="w-full py-3.5 bg-blue-50 border-2 border-blue-100 text-blue-500 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 rounded-xl font-black text-[11px] transition-all active:scale-95">HỌC LẠI TỪ ĐẦU</button>
                        <button onClick={onClose} className="w-full py-3.5 bg-white border-2 border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-600 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95">THOÁT</button>
                    </div>
                </div>
            )}
        </div>
    );
};
// --- COMPONENT MỚI: GAME TRẮC NGHIỆM CHIA ĐỘNG TỪ ---
const VerbQuizGameModal = ({ isOpen, onClose, verbsData, selectedForms }) => {
    const [queue, setQueue] = React.useState([]);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [status, setStatus] = React.useState('idle'); 
    const [finished, setFinished] = React.useState(false);
    const [initialTotal, setInitialTotal] = React.useState(0); 
    const [correctFirstTimeCount, setCorrectFirstTimeCount] = React.useState(0);
    const [wrongDetected, setWrongDetected] = React.useState(false);
    const [selectedOpt, setSelectedOpt] = React.useState(null);

    const formLabels = { 
        "Te": "Thể Te", "Ta": "Thể Ta", "Nai": "Thể Nai", 
        "Dictionary": "Thể Từ Điển", "Ba": "Thể Điều Kiện",
        "Volitional": "Thể Ý Chí", "Imperative": "Thể Mệnh Lệnh",
        "Potential": "Thể Khả Năng", "Passive": "Thể Bị Động",
        "Causative": "Thể Sai Khiến", "CausativePassive": "Bị Động Sai Khiến", "Prohibitive": "Thể Cấm Chỉ"
    };

    const initLesson = React.useCallback(() => {
        if (!verbsData || verbsData.length === 0 || !selectedForms || selectedForms.length < 4) return;
        
        setFinished(false); 
        setCurrentIndex(0);
        setStatus('idle');
        setCorrectFirstTimeCount(0);
        setWrongDetected(false);
        setSelectedOpt(null);

        // Tạo câu hỏi cho từng động từ
        const generatedQueue = verbsData.map(v => {
            // 1. Chọn ngẫu nhiên 1 thể đúng từ danh sách đã tick
            const correctFormId = selectedForms[Math.floor(Math.random() * selectedForms.length)];
            
            // 2. Chia động từ (Kanji và Hiragana)
            const conjKanji = VerbEngine.conjugate(v.vmasu, v, correctFormId).split(" / ")[0];
            const conjKana = VerbEngine.conjugate(v.finalReading, v, correctFormId).split(" / ")[0];

            // 3. Tạo 3 đáp án sai (Lấy từ các thể đã tick, loại bỏ thể đúng)
            const distractors = selectedForms.filter(f => f !== correctFormId)
                                             .sort(() => Math.random() - 0.5)
                                             .slice(0, 3);
            
            // 4. Trộn 4 đáp án
            const options = [correctFormId, ...distractors].sort(() => Math.random() - 0.5);

            return { ...v, correctFormId, conjKanji, conjKana, options };
        });

        const shuffled = generatedQueue.sort(() => Math.random() - 0.5);
        setQueue(shuffled);
        setInitialTotal(shuffled.length);
    }, [verbsData, selectedForms]);

    // 1. Quản lý việc khởi tạo bài học
    React.useEffect(() => {
        if (isOpen) {
            initLesson();
        } else {
            setFinished(false);
        }
    }, [isOpen, initLesson]);

    // 2. Xử lý khóa nền tuyệt đối (Chống cuộn trên cả PC và Mobile)
    React.useEffect(() => {
        if (isOpen) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
        } else {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = '';
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        }
    }, [isOpen]);
    const triggerConfetti = React.useCallback(() => {
        if (typeof confetti === 'undefined') return;
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 2000 });
    }, []);

    React.useEffect(() => { if (finished && isOpen) triggerConfetti(); }, [finished, isOpen, triggerConfetti]);

    const checkAnswer = (optId) => {
        if (status !== 'idle') return;
        
        const currentItem = queue[currentIndex];
        setSelectedOpt(optId);

      
        const chosenConjKanji = VerbEngine.conjugate(currentItem.vmasu, currentItem, optId).split(" / ")[0];

       
        const isCorrect = chosenConjKanji === currentItem.conjKanji;

        if (isCorrect) {
            setStatus('correct');
            if (!wrongDetected) setCorrectFirstTimeCount(prev => prev + 1);
            
            setTimeout(() => {
                
                setCurrentIndex(prevIndex => {
                    if (prevIndex < queue.length - 1) {
                        setStatus('idle');
                        setSelectedOpt(null);
                        setWrongDetected(false);
                        return prevIndex + 1;
                    } else {
                        setFinished(true);
                        return prevIndex;
                    }
                });
            }, 600);
        } else {
            setStatus('wrong');
            setWrongDetected(true);
            setQueue(prev => [...prev, currentItem]); 
            
           
            setTimeout(() => {
            
              
                setCurrentIndex(prevIndex => prevIndex + 1);
                setStatus('idle');
                setSelectedOpt(null);
                setWrongDetected(false);
            }, 600); 
        }
    };



    if (!isOpen || queue.length === 0) return null;
    const currentItem = queue[currentIndex];
    const progressVisual = (correctFirstTimeCount / initialTotal) * 100;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-zinc-900/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
            {!finished ? (
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 flex flex-col items-center border-4 border-zinc-100 relative">
                    <div className="w-full mb-8">
                        <div className="flex justify-between items-center mb-5">
                            <span className="text-[11px] font-black text-zinc-900 bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200/50 shadow-sm">
                                {correctFirstTimeCount} / {initialTotal}
                            </span>
                            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-50 border border-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-90 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div className="h-full bg-zinc-900 transition-all duration-500" style={{ width: `${progressVisual}%` }}></div>
                        </div>
                    </div>

                    {/* HIỂN THỊ CÂU HỎI KANJI & KANA */}
                    <div className="flex flex-col items-center text-center mb-10 w-full">
                        <h2 className="text-5xl font-bold font-sans text-zinc-800 mb-3">
                            {currentItem.conjKanji}
                        </h2>
                        <span className="text-lg font-bold text-indigo-600 tracking-widest bg-indigo-50 px-4 py-1 rounded-lg">
                            {currentItem.conjKana}
                        </span>
                    </div>

                  {/* 4 NÚT ĐÁP ÁN */}
                    <div className="grid grid-cols-2 gap-3 w-full">
                        {currentItem.options.map(optId => {
                            let btnStyle = "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300";
                            
                            // Tô màu khi có kết quả
                            if (status !== 'idle') {
                                const isSelected = optId === selectedOpt;

                                if (status === 'correct' && isSelected) {
                                    // Chọn đúng thì tô xanh nút đó
                                    btnStyle = "bg-green-500 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"; 
                                } else if (status === 'wrong' && isSelected) {
                                    // Chọn sai thì CHỈ TÔ ĐỎ NÚT VỪA CHỌN (Không hiện đáp án đúng nữa)
                                    btnStyle = "bg-red-500 border-red-500 text-white animate-shake"; 
                                } else {
                                    // Các nút còn lại mờ đi
                                    btnStyle = "bg-white border-zinc-100 text-zinc-300 opacity-50"; 
                                }
                            }

                            return (
                                <button
                                    key={optId}
                                    onClick={() => checkAnswer(optId)}
                                    disabled={status !== 'idle'}
                                    className={`h-16 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 flex items-center justify-center text-center px-2 leading-tight ${btnStyle}`}
                                >
                                    {formLabels[optId]}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] p-8 w-full max-w-[280px] text-center shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95">
                    <div className="text-5xl mb-4 animate-bounce cursor-pointer hover:scale-125 transition-transform" onClick={triggerConfetti}>🎉</div>
                    <h3 className="text-lg font-black text-gray-800 mb-1 uppercase">XUẤT SẮC!</h3>
                    <p className="text-gray-400 mb-6 text-[11px] font-medium italic">Bạn đã hoàn thành bài thi trắc nghiệm.</p>
                    <div className="space-y-2">
                        <button onClick={() => initLesson()} className="w-full py-3.5 bg-blue-50 border-2 border-blue-100 text-blue-500 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 rounded-xl font-black text-[11px] transition-all active:scale-95">HỌC LẠI TỪ ĐẦU</button>
                        <button onClick={onClose} className="w-full py-3.5 bg-white border-2 border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-600 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95">THOÁT</button>
                    </div>
                </div>
            )}
        </div>
    );
};
// --- COMPONENT MỚI: GAME PHẢN XẠ CHIA ĐỘNG TỪ ---
const VerbReflexGameModal = ({ isOpen, onClose, verbsData, selectedForms }) => {
    const [queue, setQueue] = React.useState([]);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [status, setStatus] = React.useState('idle'); 
    const [finished, setFinished] = React.useState(false);
    const [score, setScore] = React.useState(0);
    const [selectedOpt, setSelectedOpt] = React.useState(null);
    const [gameOverReason, setGameOverReason] = React.useState(null); // 'win', 'wrong', 'timeout'

    // Timer states
    const [timeLeft, setTimeLeft] = React.useState(10);
    const [timeLimit, setTimeLimit] = React.useState(10);

    const formLabels = { 
        "Te": "Thể Te", "Ta": "Thể Ta", "Nai": "Thể Nai ", 
        "Dictionary": "Thể Từ Điển", "Ba": "Thể Điều Kiện",
        "Volitional": "Thể Ý Chí", "Imperative": "Thể Mệnh Lệnh",
        "Potential": "Thể Khả Năng", "Passive": "Thể Bị Động",
        "Causative": "Thể Sai Khiến", "CausativePassive": "Bị Động Sai Khiến", "Prohibitive": "Thể Cấm Chỉ"
    };

    // Hàm tính thời gian đếm ngược dựa trên điểm số
    const calculateTimeLimit = (currentScore) => {
        if (currentScore < 10) return 10;
        if (currentScore < 15) return 7;
        if (currentScore < 20) return 5;
        if (currentScore < 25) return 4;
        return 3;
    };

    const initLesson = React.useCallback(() => {
        if (!verbsData || verbsData.length === 0 || !selectedForms || selectedForms.length < 4) return;
        
        setFinished(false); 
        setCurrentIndex(0);
        setStatus('idle');
        setScore(0);
        setSelectedOpt(null);
        setGameOverReason(null);
        setTimeLimit(10);
        setTimeLeft(10);

        const ALL_FORMS = ["Te", "Ta", "Nai", "Dictionary", "Ba", "Volitional", "Imperative", "Prohibitive", "Potential", "Passive", "Causative", "CausativePassive"];

        // Sinh sẵn 50 câu hỏi
        let generatedQueue = [];
        for (let i = 0; i < 50; i++) {
            const verb = verbsData[Math.floor(Math.random() * verbsData.length)];
            const correctFormId = selectedForms[Math.floor(Math.random() * selectedForms.length)];
            const conjKanji = VerbEngine.conjugate(verb.vmasu, verb, correctFormId).split(" / ")[0];

            // --- THUẬT TOÁN LỌC TRÙNG LẶP ---
            const isValidDistractor = (formId) => {
                if (formId === correctFormId) return false;
                const testKanji = VerbEngine.conjugate(verb.vmasu, verb, formId).split(" / ")[0];
                return testKanji !== conjKanji;
            };

            let pool = selectedForms.filter(isValidDistractor);
            if (pool.length < 3) {
                const extras = ALL_FORMS.filter(f => !pool.includes(f) && isValidDistractor(f));
                pool = [...pool, ...extras];
            }

            const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 3);
            const chosenForms = [correctFormId, ...distractors].sort(() => Math.random() - 0.5);

            const options = chosenForms.map(formId => {
                return {
                    id: formId,
                    textKanji: VerbEngine.conjugate(verb.vmasu, verb, formId).split(" / ")[0],
                    textKana: VerbEngine.conjugate(verb.finalReading, verb, formId).split(" / ")[0]
                }
            });

            generatedQueue.push({ verb, targetFormId: correctFormId, options });
        }
        setQueue(generatedQueue);
    }, [verbsData, selectedForms]);

    // Xử lý khóa nền
    React.useEffect(() => {
        let rafId;
        if (isOpen) {
            rafId = requestAnimationFrame(() => { document.body.style.overflow = 'hidden'; });
            initLesson();
        } else {
            document.body.style.overflow = 'unset';
            setFinished(false);
        }
        return () => { 
            if (rafId) cancelAnimationFrame(rafId);
            document.body.style.overflow = 'unset'; 
        };
    }, [isOpen, initLesson]);

    // Xử lý đếm ngược thời gian
    React.useEffect(() => {
        if (!isOpen || finished || status !== 'idle') return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setStatus('wrong');
                    setTimeout(() => {
                        setGameOverReason('timeout');
                        setFinished(true);
                    }, 800);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, finished, status, currentIndex]);

    const checkAnswer = (optId) => {
        if (status !== 'idle') return;
        const currentItem = queue[currentIndex];
        setSelectedOpt(optId);

        if (optId === currentItem.targetFormId) {
            setStatus('correct');
            const newScore = score + 1;
            setScore(newScore);
            
            if (newScore >= 50) {
                setTimeout(() => { setGameOverReason('win'); setFinished(true); }, 600);
            } else {
                setTimeout(() => {
                    const nextTimeLimit = calculateTimeLimit(newScore);
                    setTimeLimit(nextTimeLimit);
                    setTimeLeft(nextTimeLimit);
                    setCurrentIndex(prev => prev + 1);
                    setStatus('idle');
                    setSelectedOpt(null);
                }, 600);
            }
        } else {
            setStatus('wrong');
            setTimeout(() => { 
                setGameOverReason('wrong'); 
                setFinished(true); 
            }, 1000);
        }
    };

    if (!isOpen || queue.length === 0) return null;
    const currentItem = queue[currentIndex];

    // Tính % thanh thời gian
    const timePercent = (timeLeft / timeLimit) * 100;
    let timeColorClass = "bg-green-500";
    if (timePercent <= 50) timeColorClass = "bg-amber-500";
    if (timePercent <= 25) timeColorClass = "bg-red-500";

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-zinc-900/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
            {!finished ? (
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 flex flex-col items-center border-4 border-zinc-100 relative">
                    
                    {/* THANH ĐẾM NGƯỢC THỜI GIAN */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-zinc-900 text-lg font-black px-6 h-10 rounded-full shadow-md flex items-center justify-center border-4 border-zinc-100 gap-2">
                        <svg className={`w-5 h-5 ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span className={timeLeft <= 3 ? 'text-red-500 animate-pulse' : ''}>{timeLeft}s</span>
                    </div>

                    <div className="w-full mb-8 mt-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-black text-zinc-900 uppercase tracking-widest">
                                Câu {currentIndex + 1} / 50
                            </span>
                            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-50 border border-zinc-100 text-zinc-400 hover:text-red-500 transition-all shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-1000 ease-linear ${timeColorClass}`} style={{ width: `${timePercent}%` }}></div>
                        </div>
                    </div>

                    {/* HIỂN THỊ CÂU HỎI (TÊN THỂ CẦN TÌM) */}
                    <div className={`flex flex-col items-center text-center mb-10 w-full transition-all duration-300 ${status === 'correct' ? 'scale-110 opacity-50' : status === 'wrong' ? 'animate-shake' : ''}`}>
                        
                        <h2 className="text-3xl font-black font-sans text-indigo-600 mb-2 uppercase tracking-wide">
                            {formLabels[currentItem.targetFormId]}
                        </h2>
                        
                    </div>

                    {/* 4 NÚT ĐÁP ÁN KANJI */}
    <div className="grid grid-cols-2 gap-3 w-full">
        {currentItem.options.map(opt => {
       
            let btnStyle = "bg-white border-zinc-200 text-zinc-800 md:hover:bg-zinc-50 md:hover:border-indigo-300 md:hover:shadow-md";
            
            if (status !== 'idle') {
                                const isSelected = opt.id === selectedOpt;
                                if (status === 'correct' && isSelected) {
                                    btnStyle = "bg-green-500 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)] scale-105"; 
                                } else if (status === 'wrong' && isSelected) {
                                    btnStyle = "bg-red-500 border-red-500 text-white animate-shake"; 
                                } else {
                                    btnStyle = "bg-white border-zinc-100 text-zinc-300 opacity-50"; 
                                }
                            }

                           return (
                <button
                   
                    key={`${currentIndex}-${opt.id}`}
                    onClick={(e) => {
                                        e.currentTarget.blur(); 
                                        checkAnswer(opt.id);
                                    }}
                                    disabled={status !== 'idle'}
                                    className={`h-20 rounded-2xl border-2 transition-all active:scale-95 flex flex-col items-center justify-center text-center px-1 outline-none focus:outline-none ${btnStyle}`}
                                    style={{ WebkitTapHighlightColor: 'transparent' }} // Tắt chớp xanh mặc định của mobile
                                >
                                    <span className="text-2xl font-bold font-sans mb-0.5">{opt.textKanji}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                // MÀN HÌNH KẾT THÚC GAME
                <div className="bg-white rounded-[2rem] p-8 w-full max-w-[320px] text-center shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95">
                    <div className="text-5xl mb-4">
                        {gameOverReason === 'win' ? '🏆' : gameOverReason === 'timeout' ? '⏰' : '💥'}
                    </div>
                    
                    <h3 className={`text-2xl font-black mb-2 uppercase ${gameOverReason === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                        {gameOverReason === 'win' ? 'PHÁ ĐẢO!' : gameOverReason === 'timeout' ? 'HẾT GIỜ!' : 'SAI RỒI!'}
                    </h3>
                    
                    <div className="bg-zinc-50 rounded-xl p-4 mb-6 border border-zinc-100">
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Chuỗi phản xạ</p>
                        <p className="text-4xl font-black text-zinc-900">{score} <span className="text-lg text-zinc-400">/ 50</span></p>
                    </div>

                    <div className="space-y-3">
                        <button onClick={() => initLesson()} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">CHƠI LẠI TỪ ĐẦU</button>
                        <button onClick={onClose} className="w-full py-3.5 bg-white border-2 border-zinc-200 text-zinc-400 hover:text-red-600 hover:border-red-600 font-black text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95">THOÁT</button>
                    </div>
                </div>
            )}
        </div>
    );
};
// ==========================================
// COMPONENT: KAIWA MODAL (GIAO TIẾP SHADOWING)
// ==========================================
const KaiwaModal = ({ isOpen, onClose }) => {
    // --- BẢN ĐỒ CẤU HÌNH NHÓM BÀI THỦ CÔNG ---
    // Đã phân chia chuẩn xác theo dữ liệu JSON của bạn
    const MANUAL_PARTS_CONFIG = {
        '42baisotrungcap': [
            { title: "Phần 1", desc: "Gồm 10 bài", lessonCount: 10 },
            { title: "Phần 2", desc: "Gồm 9 bài", lessonCount: 9 },
            { title: "Phần 3", desc: "Gồm 8 bài", lessonCount: 8 },
            { title: "Phần 4", desc: "Gồm 8 bài", lessonCount: 8 },
            { title: "Phần 5", desc: "Gồm 7 bài", lessonCount: 7 }
        ],
        'nameraka': [
            { title: "BIẾN ÂM", desc: "Gồm 6 bài", lessonCount: 6 },
            { title: "HÌNH THÁI HỘI THOẠI", desc: "Gồm 6 bài", lessonCount: 6 },
            { title: "MỤC ĐÍCH HỘI THOẠI", desc: "Gồm 11 bài", lessonCount: 11 }
        ],
           '22baitrungthuongcap': [
            { title: "Phần 1", desc: "Gia đình, người yêu", lessonCount: 5 },
            { title: "Phần 2", desc: "Bạn bè", lessonCount: 5 },
            { title: "Phần 3", desc: "Người quen, hàng xóm", lessonCount: 5 },
            { title: "Phần 4", desc: "Bác sĩ, nhân viên cửa hàng...", lessonCount: 5 },
            { title: "Phần 5", desc: "Đồng nghiệp", lessonCount: 5 },
            { title: "Phần 6", desc: "Cấp trên, cấp dưới", lessonCount: 5 },
            { title: "Phần 7", desc: "Người ngoài công ty, người phỏng vấn", lessonCount: 3 },
            { title: "Phần 8", desc: "Hội thoại dài, bài phát biểu", lessonCount: 8 },
        ]
    };

    const [view, setView] = React.useState('categories'); 
    
    const [allLessons, setAllLessons] = React.useState([]); 
    const [parts, setParts] = React.useState([]); 
    const [selectedPartIdx, setSelectedPartIdx] = React.useState(0); 
    
    const [currentLessonIdx, setCurrentLessonIdx] = React.useState(0); 
    const [isLoading, setIsLoading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [courseCache, setCourseCache] = React.useState({});
    const [isGuideOpen, setIsGuideOpen] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else {
            document.body.style.overflow = 'unset';
            setView('categories'); 
            setIsGuideOpen(false);
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const loadCategory = async (level) => {
    // 1. KIỂM TRA BỘ NHỚ TẠM (CACHE)
    // Nếu giáo trình này đã được tải trước đó, lấy ra dùng luôn và bỏ qua loading
    if (courseCache[level]) {
        setAllLessons(courseCache[level].data);
        setParts(courseCache[level].parts);
        setView('parts');
        return; 
    }

    // 2. NẾU CHƯA CÓ TRONG BỘ NHỚ TẠM -> BẮT ĐẦU TẢI VÀ HIỆN LOADING
    setIsLoading(true);
    setProgress(20);
    try {
        const response = await fetch(`./data/sachkaiwa/sachkaiwa${level}.json`);
        if (!response.ok) throw new Error("Chưa có data");
        const data = await response.json();
        
        const config = MANUAL_PARTS_CONFIG[level];
        const chunkedParts = [];

        if (config) {
            let currentIndex = 0;
            config.forEach((partConfig) => {
                const lessonsInPart = data.slice(currentIndex, currentIndex + partConfig.lessonCount);
                if (lessonsInPart.length > 0) {
                    chunkedParts.push({
                        title: partConfig.title,
                        desc: partConfig.desc,
                        lessons: lessonsInPart,
                        startIndex: currentIndex 
                    });
                }
                currentIndex += partConfig.lessonCount;
            });

            if (currentIndex < data.length) {
                chunkedParts.push({
                    title: "Phần bổ sung",
                    desc: `Các bài còn lại`,
                    lessons: data.slice(currentIndex),
                    startIndex: currentIndex
                });
            }
        } else {
            const CHUNK_SIZE = 10;
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                chunkedParts.push({
                    title: `Phần ${Math.floor(i / CHUNK_SIZE) + 1}`,
                    desc: `Từ bài ${i + 1} đến bài ${Math.min(i + CHUNK_SIZE, data.length)}`,
                    lessons: data.slice(i, i + CHUNK_SIZE),
                    startIndex: i
                });
            }
        }
        
        // 3. LƯU DỮ LIỆU VỪA TẢI VÀO BỘ NHỚ TẠM (CACHE) ĐỂ LẦN SAU DÙNG
        setCourseCache(prev => ({
            ...prev,
            [level]: {
                data: data,
                parts: chunkedParts
            }
        }));

        setAllLessons(data);
        setParts(chunkedParts);

        // Đẩy thanh loading lên 100% và chuyển giao diện
        setProgress(100);
        setTimeout(() => {
            setView('parts'); 
            setIsLoading(false);
        }, 400);

    } catch (error) {
        alert(`Đang cập nhật bộ dữ liệu ${level.toUpperCase()}!`);
        setIsLoading(false);
    }
};
    // Thêm toàn bộ block này vào trước const renderCategories:

const renderGuideOverlay = () => (
    <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-10 duration-300">
        {/* Header Guide */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100 bg-white z-10 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsGuideOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <h2 className="text-lg font-black text-zinc-900 uppercase tracking-tight">Hướng dẫn học Kaiwa</h2>
            </div>
        </div>

        {/* Content Guide */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-zinc-50/30">
            <div className="max-w-2xl mx-auto space-y-8">
                
                {/* Section 1 */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                    <h3 className="text-base font-black text-indigo-600 uppercase mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Shadowing là gì?
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                        <strong className="text-zinc-900">Shadowing</strong> là kỹ thuật luyện nghe nói bằng cách nghe một đoạn hội thoại và lặp lại ngay lập tức giống như một cái bóng bám theo âm thanh gốc. Khác với nghe-lặp-lại truyền thống, bạn phải nói song song với audio.
                    </p>
                </div>

                {/* Section 2 */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                    <h3 className="text-base font-black text-indigo-600 uppercase mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Tại sao lại cần Shadowing?
                    </h3>
                    <ul className="space-y-3 text-sm text-zinc-600 font-medium">
                        <li className="flex items-start gap-2">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
                            <span><strong className="text-zinc-900">Ngữ điệu chuẩn xác:</strong> Giúp bạn nắm bắt được sự lên xuống giọng và cách ngắt nghỉ tự nhiên của người Nhật.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
                            <span><strong className="text-zinc-900">Luyện cơ miệng:</strong> Quen với tốc độ nói thật, không bị vấp hay "líu lưỡi" khi giao tiếp.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
                            <span><strong className="text-zinc-900">Phản xạ nhanh:</strong> Rèn luyện não bộ xử lý thông tin âm thanh đồng thời với việc phát âm.</span>
                        </li>
                    </ul>
                </div>

                {/* Section 3 */}
                <div>
                    <h3 className="text-lg font-black text-zinc-900 uppercase tracking-wide mb-4">PHƯƠNG PHÁP LUYỆN TẬP</h3>
                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white font-black flex items-center justify-center shrink-0">1</div>
                            <div>
                                <h4 className="font-black text-zinc-900 mb-1 uppercase text-sm tracking-wide">Shadowing câm (Silent Shadowing)</h4>
                                <p className="text-sm text-zinc-500 font-medium leading-relaxed">Luyện tập không nói thành lời âm thanh nghe được mà chỉ nhẩm trong đầu. Những đoạn hội thoại có tốc độ nhanh, những mẫu câu khó, trước hết hãy thử với phương pháp này.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white font-black flex items-center justify-center shrink-0">2</div>
                            <div>
                                <h4 className="font-black text-zinc-900 mb-1 uppercase text-sm tracking-wide">Nhẩm theo (Whispering)</h4>
                                <p className="text-sm text-zinc-500 font-medium leading-relaxed">Luyện tập không phát âm rõ tiếng nghe được mà chỉ nhẩm lại với tiếng thì thầm. Hãy làm quyen với cảm giác của ngữ điệu.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white font-black flex items-center justify-center shrink-0">3</div>
                            <div>
                                <h4 className="font-black text-zinc-900 mb-1 uppercase text-sm tracking-wide">Shadowing nhịp điệu (Prosody Shadowing)</h4>
                                <p className="text-sm text-zinc-500 font-medium leading-relaxed">Luyện tập chú trọng đặc biệt tới nhịp điệu và ngữ điệu.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white font-black flex items-center justify-center shrink-0">4</div>
                            <div>
                                <h4 className="font-black text-zinc-900 mb-1 uppercase text-sm tracking-wide">Shadowing nội dung (Contents Shadowing)</h4>
                                <p className="text-sm text-zinc-500 font-medium leading-relaxed">Luyện tập có chú ý đến việc hiểu ý nghĩa. Khi đã luyện tập kỹ Shadowing theo nhịp điệu và có thể thực hiện tốt rồi, hãy vừa shadowing vừa hình dung ý nghĩa và bối cảnh.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-5 bg-indigo-50 rounded-2xl border border-indigo-200 shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black flex items-center justify-center shrink-0">5</div>
                            <div>
                                <h4 className="font-black text-indigo-900 mb-1 uppercase text-sm tracking-wide">Nhập vai thực chiến</h4>
                                <p className="text-sm text-indigo-800 font-medium leading-relaxed mb-3">Dùng công cụ của web để tự giao tiếp như nói chuyện với người thật:</p>
                                <ul className="space-y-2 text-xs font-bold text-indigo-700">
                                    <li className="flex items-center gap-2"><span className="px-2 py-1 bg-white rounded shadow-sm border border-indigo-100">Tập vai A/B</span> Tự động tắt tiếng nhân vật bạn chọn để bạn tự đọc.</li>
                                    <li className="flex items-center gap-2"><span className="px-2 py-1 bg-white rounded shadow-sm border border-indigo-100">Ẩn lời thoại</span> Làm mờ văn bản ép bạn phản xạ bằng trí nhớ.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
    const renderCategories = () => (
        <div className="flex flex-col h-full overflow-hidden bg-white relative">
        {isGuideOpen && renderGuideOverlay()}
            
            {/* HEADER CỐ ĐỊNH KHÔNG BỊ TRÔI */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100 bg-white z-10 shadow-sm shrink-0">
                <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">Chọn bộ giáo trình</h2>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
            </div>
            
            {/* NỘI DUNG CUỘN ĐƯỢC BÊN DƯỚI */}
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                
                {/* DANH SÁCH GIÁO TRÌNH HIỆN CÓ */}
                <div className="flex flex-col gap-4">
                    {[
                        { id: '42baisotrungcap', title: '42 BÀI KAIWA N5-N3', desc: 'Hội thoại hàng ngày' },
                        { id: 'nameraka', title: '23 BÀI KAIWA N3', desc: 'Hội thoại tiếng Nhật tự nhiên' },
                        { id: '22baitrungthuongcap', title: '22 BÀI KAIWA N3-N1', desc: 'Hội thoại theo các mối quan hệ' }
                    ].map((item) => (
                        <button 
                            key={item.id}
                            onClick={() => loadCategory(item.id)}
                            className="w-full p-5 sm:p-6 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-900 hover:shadow-md transition-all flex flex-col items-start active:scale-95 group relative overflow-hidden"
                        >
                            <div className="flex justify-between items-center w-full gap-4">
                                <span className="text-lg sm:text-xl font-black text-zinc-900 uppercase text-left leading-tight">
                                    {item.title}
                                </span>
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-zinc-500 mt-1.5 text-left">{item.desc}</span>
                        </button>
                    ))}
                </div>
{/* HƯỚNG DẪN HỌC */}
            <button 
                onClick={() => setIsGuideOpen(true)} 
                className="mt-4 w-full p-4 sm:p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between group transition-all hover:border-indigo-300 hover:shadow-md active:scale-95"
            >
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-sm sm:text-base font-black text-indigo-900 uppercase tracking-wide leading-tight">Hướng dẫn học</span>
                        <span className="text-xs sm:text-sm font-bold text-indigo-500 mt-0.5">Phương pháp Shadowing & Nhập vai</span>
                    </div>
                </div>
                <svg className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>


                {/* ĐƯỜNG PHÂN CÁCH SẮP RA MẮT */}
                <div className="flex items-center gap-4 my-8">
                    <div className="h-px bg-zinc-200 flex-1"></div>
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-200">
                        Sắp ra mắt
                    </span>
                    <div className="h-px bg-zinc-200 flex-1"></div>
                </div>

                {/* DANH SÁCH GIÁO TRÌNH GIẢ (LÀM MỜ, KHÔNG BẤM ĐƯỢC) */}
                <div className="flex flex-col gap-4 pb-6">
                    {[
                        { id: 'dummy1', title: '200 ĐOẠN KAIWA N5-N4', desc: 'Phản xạ nhanh, dùng liền' },
                        { id: 'dummy2', title: '210 ĐOẠN HỘI THOẠI N3-N2', desc: 'Luyện nói ngắn gọn mỗi ngày' },
                        { id: 'dummy3', title: '125 CÂU NÂNG CAO N2-N1', desc: 'Hiểu và nói tự nhiên hơn' },
                        { id: 'dummy4', title: '180 CÂU BIỂU ĐẠT CẢM XÚC', desc: 'Nói tự nhiên, truyền đạt cảm xúc' }
                    ].map((item) => (
                        <button 
                            key={item.id}
                            disabled
                            className="w-full p-5 sm:p-6 bg-zinc-50/50 border border-zinc-100 rounded-2xl flex flex-col items-start cursor-not-allowed opacity-60 relative overflow-hidden"
                        >
                            <div className="flex justify-between items-center w-full">
                                <span className="text-lg sm:text-xl font-black text-zinc-400 uppercase text-left leading-tight">
                                    {item.title}
                                </span>
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-zinc-400 mt-1.5 text-left">{item.desc}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

  const renderParts = () => (
        <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
            <div className="p-4 bg-white border-b border-zinc-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView('categories')} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <h2 className="text-sm font-black text-zinc-900 uppercase">Chọn phần học</h2>
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
                {parts.map((part, idx) => (
                    <button 
                        key={idx}
                        onClick={() => { setSelectedPartIdx(idx); setView('list'); }}
                        // Đã thêm md:hover
                        className="w-full p-5 bg-white border border-zinc-200 rounded-xl text-left md:hover:border-indigo-400 md:hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-between group"
                    >
                        <div className="flex flex-col">
                            {/* Đã thêm md:group-hover */}
                            <span className="text-lg font-black text-zinc-800 font-sans md:group-hover:text-indigo-600 transition-colors uppercase tracking-wide">{part.title}</span>
                            <span className="text-xs font-bold text-zinc-400 mt-1">{part.desc}</span>
                        </div>
                        {/* Đã thêm md:group-hover */}
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center md:group-hover:bg-indigo-50 transition-colors">
                            <svg className="w-4 h-4 text-zinc-400 md:group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderList = () => {
        const currentPart = parts[selectedPartIdx];
        if (!currentPart) return null;

        return (
            <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
                <div className="p-4 bg-white border-b border-zinc-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setView('parts')} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <h2 className="text-sm font-black text-zinc-900 uppercase">{currentPart.title}</h2>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto custom-scrollbar flex-1">
                    {currentPart.lessons.map((lesson, idx) => {
                        const globalIdx = currentPart.startIndex + idx; 
                        return (
                            <button 
                                key={lesson.id || globalIdx}
                                onClick={() => { setCurrentLessonIdx(globalIdx); setView('detail'); }}
                                // Đã thêm md:hover
                                className="w-full p-4 bg-white border border-zinc-200 rounded-xl text-left md:hover:border-indigo-400 md:hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-between group"
                            >
                                {/* Đã thêm md:group-hover */}
                                <span className="text-base sm:text-lg font-bold text-zinc-800 font-sans md:group-hover:text-indigo-600 transition-colors">{lesson.title}</span>
                                <span className="text-xs font-bold text-zinc-300">#{idx + 1}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[500] flex justify-center items-center bg-zinc-900/90 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full h-full sm:h-[90vh] max-w-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* --- GIAO DIỆN LOADING MỚI --- */}
            {isLoading && (
                <div className="absolute inset-0 z-[600] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md">
                    <div className="text-center">
                        <span className="text-xs font-bold text-gray-900 uppercase tracking-widest animate-pulse mb-4 block">
                            Đang tải dữ liệu... {progress}%
                        </span>
                        <div className="w-48 bg-gray-200 rounded-full h-1.5 overflow-hidden mx-auto">
                            <div className="bg-gray-900 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
            )}
                {view === 'categories' && renderCategories()}
                {view === 'parts' && renderParts()}
                {view === 'list' && renderList()}
                
                {view === 'detail' && (
                    <KaiwaPracticeView 
                        lesson={allLessons[currentLessonIdx]} 
                        total={allLessons.length}
                        currentIndex={currentLessonIdx}
                        onBack={() => setView('list')} 
                        onClose={onClose} 
                        onNext={() => setCurrentLessonIdx(prev => Math.min(prev + 1, allLessons.length - 1))}
                        onPrev={() => setCurrentLessonIdx(prev => Math.max(prev - 1, 0))}
                    />
                )}
            </div>
        </div>
    );
};

let hasWarnedAudioGlobal = false;
// ==========================================
// COMPONENT: KAIWA PRACTICE VIEW (SỬ DỤNG HOWLER.JS SIÊU MƯỢT)
// ==========================================
const KaiwaPracticeView = ({ lesson, total, currentIndex, onBack, onClose, onNext, onPrev }) => {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isAudioLoading, setIsAudioLoading] = React.useState(false);
    const [showTranslation, setShowTranslation] = React.useState(false);
    const [roleplayMode, setRoleplayMode] = React.useState('all'); 
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [playbackRate, setPlaybackRate] = React.useState(1);
    const [isDragging, setIsDragging] = React.useState(false);
    const [showFurigana, setShowFurigana] = React.useState(false);
    const [isAutoScroll, setIsAutoScroll] = React.useState(true); 
    const [activeIndex, setActiveIndex] = React.useState(-1);  
    const [showAudioWarning, setShowAudioWarning] = React.useState(false);
    const [hideText, setHideText] = React.useState(false);
    const [isGuideOpen, setIsGuideOpen] = React.useState(false);
    const triggerAudioWarning = () => {
        if (!hasWarnedAudioGlobal) {
            setShowAudioWarning(true);
            hasWarnedAudioGlobal = true; // Đánh dấu là đã hiện
        }
    };
    const closeAudioWarning = (e) => {
        if (e) e.stopPropagation();
        setShowAudioWarning(false);
    };
    
    const lineRefs = React.useRef([]);
    const soundRef = React.useRef(null); 
    const timerRef = React.useRef(null); 
    const scrollRef = React.useRef(null);
    const stopAtTimeRef = React.useRef(null);
    const isMutedRef = React.useRef(false);

    // --- HÀM TẢI VÀ PHÁT AUDIO THỦ CÔNG (LAZY LOAD) ---
    // --- HÀM TẢI VÀ PHÁT AUDIO THỦ CÔNG (LAZY LOAD) ---
    const initAndPlayAudio = (startTime = 0) => {
        if (isAudioLoading) return; // Chống spam click khi đang tải
        setIsAudioLoading(true);

        const howlInstance = new Howl({
            src: [lesson.audioPath],
            html5: true, 
            preload: true,
            onload: function() {
                // FIX LỖI DÍNH ÂM THANH
                if (soundRef.current !== howlInstance) {
                    howlInstance.unload(); 
                    return; 
                }

                setDuration(this.duration());
                setIsAudioLoading(false); 
                
                this.rate(playbackRate); 

                // Tua đến đúng chỗ nếu bấm vào câu thoại
                if (startTime > 0) {
                    this.seek(startTime);
                    setCurrentTime(startTime);
                }
                
                this.play();
                setIsPlaying(true);
                triggerAudioWarning();
            },
            onloaderror: function() {
                if (soundRef.current !== howlInstance) return;
                setIsAudioLoading(false);
                alert("Lỗi tải âm thanh!");
            },
            onend: function() {
                if (soundRef.current !== howlInstance) return;
                
                // TỰ ĐỘNG LẶP LẠI: Tua về 0 và tiếp tục phát
                this.seek(0);
                setCurrentTime(0);
                this.play();
            }
        });

        // Gán instance vừa tạo vào biến toàn cục để theo dõi
        soundRef.current = howlInstance;
    };
    
    // --- 1. CHỈ DỌN DẸP KHI CHUYỂN BÀI MỚI ---
    React.useEffect(() => {
        if (soundRef.current) {
            soundRef.current.unload();
            soundRef.current = null; // Đưa về null để báo là chưa tải file
        }
        setIsPlaying(false);
        setCurrentTime(0);
        setActiveIndex(-1);
        setIsAudioLoading(false);

        if (scrollRef.current) scrollRef.current.scrollTop = 0;

        return () => {
            if (soundRef.current) {
                soundRef.current.unload();
                soundRef.current = null;
            }
            if (timerRef.current) cancelAnimationFrame(timerRef.current);
        };
    }, [lesson]);

    // --- 2. CẬP NHẬT TỐC ĐỘ PHÁT ---
    React.useEffect(() => {
        if (soundRef.current) { 
            soundRef.current.rate(playbackRate); 
        }
    }, [playbackRate]);

    // --- 3. VÒNG LẶP 60FPS: TRACKING THỜI GIAN & TẮT ÂM THANH CHUẨN XÁC ---
    React.useEffect(() => {
        const convs = lesson.conversations || [{ dialogues: lesson.dialogues }];
        const flatLines = [];
        convs.forEach(conv => {
            conv.dialogues.forEach(line => {
                if (line.startTime !== undefined && line.endTime !== undefined) {
                    flatLines.push(line);
                }
            });
        });

        const step = () => {
            if (soundRef.current && isPlaying && !isDragging) {
                const seekTime = soundRef.current.seek();
                
                // Đề phòng Howler trả về mảng khi đang loading
                if (typeof seekTime === 'number') {
                    setCurrentTime(seekTime);

                    if (stopAtTimeRef.current !== null && seekTime >= stopAtTimeRef.current) {
                        soundRef.current.pause();
                        setIsPlaying(false);
                        stopAtTimeRef.current = null; // Xóa mốc thời gian
                        return; // Dừng vòng lặp hiện tại
                    } 
                    
                    let foundIndex = -1;
                    let currentSpeaker = null;

                    // Quét để tìm câu đang nói và xử lý chặn họng
                    for (let i = 0; i < flatLines.length; i++) {
                        const line = flatLines[i];
                        
                        // Tìm UI đang sáng
                        if (seekTime >= line.startTime && seekTime <= line.endTime) {
                            foundIndex = i;
                        }

                        // Tìm nhân vật để Mute (Trừ hao cực nhẹ 0.05s vì Howler ngắt tức thì)
                        const lookaheadTime = seekTime + 0.05;
                        const isMutedCharacter = (roleplayMode === 'hideA' && line.speaker === 'A') || 
                                                 (roleplayMode === 'hideB' && line.speaker === 'B');
                        
                        if (isMutedCharacter && lookaheadTime >= line.startTime && seekTime <= line.endTime) {
                            currentSpeaker = line.speaker;
                        }
                    }

                    // Tự động cuộn UI
                    if (foundIndex !== activeIndex) {
                        setActiveIndex(foundIndex);
                        if (foundIndex !== -1 && isAutoScroll && lineRefs.current[foundIndex]) {
                            lineRefs.current[foundIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }

                    // Tắt tiếng triệt để (Đã tối ưu cho HTML5 Audio)
                    const shouldMute = !!currentSpeaker; // Ép kiểu về true/false
                    if (shouldMute !== isMutedRef.current) {
                        soundRef.current.mute(shouldMute); // Dùng mute() thay vì volume()
                        isMutedRef.current = shouldMute;
                    }
                }
            } else if (soundRef.current && !isPlaying) {
                // Nhả âm lượng khi ấn Pause
                if (isMutedRef.current) {
                    soundRef.current.mute(false);
                    isMutedRef.current = false;
                }
            }
            
            timerRef.current = requestAnimationFrame(step);
        };

        if (isPlaying) {
            timerRef.current = requestAnimationFrame(step);
        }

        return () => {
            if (timerRef.current) cancelAnimationFrame(timerRef.current);
        };
    }, [isPlaying, roleplayMode, isAutoScroll, activeIndex, isDragging, lesson]);

    // --- CÁC HÀM TIỆN ÍCH CHO TRÌNH PHÁT ---
    const toggleAudio = () => {
        if (isAudioLoading) return;
        
        // CHƯA TẢI FILE -> Gọi hàm tải và tự động phát
        if (!soundRef.current) {
            initAndPlayAudio(0);
            return;
        }

        // ĐÃ TẢI FILE -> Phát/Dừng bình thường
        if (isPlaying) {
            soundRef.current.pause();
            setIsPlaying(false);
        } else {
            stopAtTimeRef.current = null; 
            soundRef.current.play();
            setIsPlaying(true);
            triggerAudioWarning();
        }
    };
    
    const formatTime = (time) => {
        if (isNaN(time)) return "0:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleSeek = (e) => {
        if (isAudioLoading) return; // Thêm chặn ở đây
        const time = Number(e.target.value);
        setCurrentTime(time);
        if (soundRef.current) { 
            soundRef.current.seek(time); 
        }
    };

    const cyclePlaybackRate = () => {
        const rates = [0.5, 0.75, 1, 1.25, 1.5];
        const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
        setPlaybackRate(rates[nextIdx]);
    };

    const renderFurigana = (text, isShow) => {
        if (!text) return null;
        const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
        return parts.map((part, index) => {
            const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (match) {
                return (
                    <ruby key={index} className="leading-loose">
                        {match[1]}
                        {isShow && <rt className="text-[11px] sm:text-xs text-indigo-500 font-bold select-none">{match[2]}</rt>}
                    </ruby>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };
// THÊM HOẶC THAY THẾ HÀM CŨ BẰNG HÀM NÀY
    const renderMarkedText = (text, isShowFuri) => {
        if (!text) return null;
        
        // Tách câu thành các mảng dựa trên dấu _ _
        const parts = text.split(/(_[^_]+_)/g);
        
        return parts.map((part, index) => {
            // Nếu đoạn text được bọc bởi _ _
            if (part.startsWith('_') && part.endsWith('_')) {
                const innerText = part.slice(1, -1);
                return (
                    // Đổi màu chữ ở đây
                    <span key={index} className="text-orange-800">
                        {renderFurigana(innerText, isShowFuri)}
                    </span>
                );
            }
            // Những phần chữ thường thì render bình thường
            return <React.Fragment key={index}>{renderFurigana(part, isShowFuri)}</React.Fragment>;
        });
    };
    let globalLineIndex = 0;

    // --- GIAO DIỆN ---
    return (
        <div className="flex flex-col h-full bg-white overflow-hidden relative">
            <div className="px-4 py-3 bg-white border-b border-zinc-100 flex items-center justify-between sticky top-0 z-10 shadow-sm relative">
                <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 px-2 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors relative z-10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    QUAY LẠI
                </button>
                <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-black text-zinc-400 tracking-widest bg-zinc-50 px-3 py-1 rounded-full border border-zinc-200">
                    {currentIndex + 1} / {total}
                </span>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-500 transition-all relative z-10">✕</button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 pb-8 custom-scrollbar">
                <div className="mb-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-2 leading-tight font-sans">{lesson.title}</h2>
                    <p className="text-sm sm:text-base font-medium text-zinc-500 italic">{lesson.translation}</p>
                </div>

                {lesson.explanation && (
                    <div className="bg-zinc-50 border-l-4 border-zinc-800 p-3 sm:p-4 rounded-r-xl mb-6">
                        <p className="text-sm text-zinc-700 leading-relaxed font-medium">
                            <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest block mb-1">💡 Giải thích</span>
                            
                            {/* DÙNG JAVASCRIPT CHUYỂN ĐỔI TRỰC TIẾP THÀNH THẺ <br/> */}
                            {String(lesson.explanation)
                                .replace(/\\n/g, '\n') 
                                .split('\n')
                                .map((line, index) => (
                                    <React.Fragment key={index}>
                                        {line}
                                        <br />
                                    </React.Fragment>
                                ))}
                                
                        </p>
                    </div>
                )}

                <div className="flex flex-wrap gap-3 justify-between items-center mb-6 pb-4 border-b border-zinc-100">
                    <div className="flex bg-zinc-100 p-1 rounded-xl">
                        <button onClick={() => setRoleplayMode('all')} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${roleplayMode === 'all' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>Nghe hết</button>
                        <button onClick={() => setRoleplayMode('hideA')} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${roleplayMode === 'hideA' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-700'}`}>Tập vai A</button>
                        <button onClick={() => setRoleplayMode('hideB')} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${roleplayMode === 'hideB' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-700'}`}>Tập vai B</button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {/* THÊM MỚI: Nút Ẩn lời thoại (Chỉ hiện khi chọn Tập vai A hoặc B) */}
                        {roleplayMode !== 'all' && (
                            <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 px-3 py-1.5 sm:py-2 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors animate-in zoom-in-95 duration-200">
                                <span className="text-[10px] sm:text-xs font-bold text-indigo-700 uppercase">Ẩn lời thoại</span>
                                <input type="checkbox" checked={hideText} onChange={() => setHideText(!hideText)} className="accent-indigo-600 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
                            </label>
                        )}
                        
                        <label className="flex items-center gap-2 cursor-pointer bg-zinc-50 px-3 py-1.5 sm:py-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 transition-colors">
                            <span className="text-[10px] sm:text-xs font-bold text-zinc-600 uppercase">Tự cuộn</span>
                            
                            <input type="checkbox" checked={isAutoScroll} onChange={() => setIsAutoScroll(!isAutoScroll)} className="accent-zinc-900 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-zinc-50 px-3 py-1.5 sm:py-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 transition-colors">
                            <span className="text-[10px] sm:text-xs font-bold text-zinc-600 uppercase">Furigana</span>
                            <input type="checkbox" checked={showFurigana} onChange={() => setShowFurigana(!showFurigana)} className="accent-zinc-900 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-zinc-50 px-3 py-1.5 sm:py-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 transition-colors">
                            <span className="text-[10px] sm:text-xs font-bold text-zinc-600 uppercase">Dịch</span>
                            <input type="checkbox" checked={showTranslation} onChange={() => setShowTranslation(!showTranslation)} className="accent-zinc-900 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
                        </label>
                    </div>
                </div>

                <div className="space-y-8"> 
                    {(lesson.conversations || [{ dialogues: lesson.dialogues }]).map((conv, convIdx, arr) => (
                        <div key={convIdx} className="space-y-4 relative">
                            {arr.length > 1 && (
                                <div className="flex items-center gap-4 mb-6 mt-2">
                                    <div className="h-px bg-zinc-200 flex-1"></div>
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-zinc-200 shadow-sm">
                                        {conv.context ? conv.context : `Đoạn hội thoại ${convIdx + 1}`}
                                    </span>
                                    <div className="h-px bg-zinc-200 flex-1"></div>
                                </div>
                            )}

                            {conv.dialogues.map((line, idx) => {
                                const currentFlatIndex = globalLineIndex++; 
                                const isActive = activeIndex === currentFlatIndex; 
                                
                                // THAY ĐỔI: Chỉ ẩn khi đang chọn vai ĐỒNG THỜI bật tính năng ẩn chữ
                                const isMutedRole = (roleplayMode === 'hideA' && line.speaker === 'A') || 
                                                    (roleplayMode === 'hideB' && line.speaker === 'B');
                                const isHidden = isMutedRole && hideText; 
                                
                                const isA = line.speaker === 'A';
                                
                                let boxClass = isA 
                                    ? 'bg-zinc-50 border-zinc-200 text-zinc-900 rounded-2xl rounded-tl-sm' 
                                    : 'bg-zinc-50 border-zinc-900 text-zinc-900 rounded-2xl rounded-tr-sm border-2 shadow-md';

                                if (isActive) {
                                    boxClass = isA 
                                        ? 'bg-green-50 border-[2px] border-green-500 rounded-2xl rounded-tl-sm shadow-[0_0_15px_rgba(34,197,94,0.2)]' 
                                        : 'bg-green-50 border-[2px] border-green-500 text-zinc-900 rounded-2xl rounded-tr-sm shadow-[0_0_15px_rgba(34,197,94,0.2)]';
                                }

                                return (
                                    <div 
                                        key={`${convIdx}-${idx}`} 
                                        ref={(el) => (lineRefs.current[currentFlatIndex] = el)}
                                        className={`flex flex-col w-full ${isA ? 'items-start' : 'items-end'} transition-all duration-300`}
                                    >
                                        <span className={`text-[9px] font-black uppercase tracking-widest mb-1 px-1 transition-colors ${isActive ? 'text-green-600' : 'text-zinc-400'}`}>
                                            Người {line.speaker}
                                        </span>
                                        <div 
            onClick={(e) => {
                if (line.startTime === undefined) return;
                
                // THÊM DÒNG NÀY ĐỂ CHẶN CLICK KHI ĐANG LOAD FILE (Chống chồng âm thanh)
                if (isAudioLoading) return;
                
                // CHƯA TẢI FILE -> Đặt mốc thời gian dừng rồi gọi hàm tải
                if (!soundRef.current) {
                    stopAtTimeRef.current = line.endTime;
                    initAndPlayAudio(line.startTime);
                    return;
                }

                // ĐÃ TẢI FILE -> Seek và phát như cũ
                soundRef.current.seek(line.startTime);
                setCurrentTime(line.startTime);
                
                if (isPlaying && stopAtTimeRef.current === null) {
                    stopAtTimeRef.current = null;
                } else {
                    stopAtTimeRef.current = line.endTime;
                    if (!isPlaying) {
                        soundRef.current.play();
                        setIsPlaying(true);
                        triggerAudioWarning();
                    }
                }
            }}
            title="Bấm để nghe câu này"
            className={`max-w-[80%] md:max-w-[65%] p-3 sm:p-4 shadow-sm border transition-all duration-300 cursor-pointer hover:shadow-md active:scale-[0.98] ${boxClass}`}
        >
                                          <p className={`text-base sm:text-lg font-bold leading-relaxed font-sans transition-all duration-300 ${isHidden ? 'filter blur-[4px] opacity-40 select-none' : ''}`}>
    {isHidden ? "（あなたが話す番です）" : renderMarkedText(line.ja, showFurigana)}
</p>
                                            {showTranslation && (
                                                <p className={`text-sm sm:text-base mt-2 font-medium border-t pt-2 transition-colors ${isActive ? 'text-green-700 border-green-200' : 'text-zinc-500 border-zinc-200'}`}>
                                                    {line.vi}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* THANH PLAYER AUDIO Ở DƯỚI */}
            <div className="w-full shrink-0 bg-white border-t border-zinc-200 px-4 py-3 flex flex-col gap-2 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
                <div className="flex items-center gap-3 w-full">
                    <span className="text-[10px] font-bold text-zinc-400 w-8 text-right">{formatTime(currentTime)}</span>
                    <input
                        type="range" min={0} max={duration || 100} value={currentTime}
                        onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)}
                        onTouchStart={() => setIsDragging(true)} onTouchEnd={() => setIsDragging(false)}
                        onChange={handleSeek}
                        className="flex-1 h-1.5 accent-zinc-900 bg-zinc-200 rounded-full appearance-none cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-zinc-400 w-8">{formatTime(duration)}</span>
                </div>
                <div className="flex items-center justify-between w-full">
                    <button onClick={cyclePlaybackRate} className="w-12 py-1.5 text-[10px] font-black text-zinc-600 bg-zinc-100 rounded-md hover:bg-zinc-200 transition-colors active:scale-95 text-center">
                        {playbackRate}x
                    </button>
                    <div className="flex items-center gap-1 sm:gap-3">
                        <button onClick={onPrev} disabled={currentIndex === 0} className={`p-2 rounded-full transition-all active:scale-90 ${currentIndex === 0 ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <button onClick={() => { if(soundRef.current) { const cur = soundRef.current.seek(); soundRef.current.seek(Math.max(0, cur - 3)); setCurrentTime(Math.max(0, cur - 3)); } }} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all active:scale-90" title="Lùi 3 giây">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        </button>
                        <button 
                            onClick={toggleAudio} 
                            disabled={isAudioLoading} 
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md mx-1 ${isAudioLoading ? 'bg-zinc-400 cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-black active:scale-90'}`}
                        >
                            {isAudioLoading ? (
                                // THÊM MỚI: Hiệu ứng 3 dấu chấm nảy gợn sóng
                                <div className="flex space-x-1 justify-center items-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                                </div>
                            ) : isPlaying ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><polygon points="6 4 19 12 6 20 6 4"></polygon></svg>
                            )}
                        </button>
                        <button onClick={() => { if(soundRef.current) { const cur = soundRef.current.seek(); soundRef.current.seek(Math.min(duration, cur + 3)); setCurrentTime(Math.min(duration, cur + 3)); } }} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all active:scale-90" title="Tiến 3 giây">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                        </button>
                        <button onClick={onNext} disabled={currentIndex === total - 1} className={`p-2 rounded-full transition-all active:scale-90 ${currentIndex === total - 1 ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    </div>
                    {/* NÚT HƯỚNG DẪN (?) BÊN GÓC PHẢI - Hover xám/đen */}
                    <div className="w-12 flex justify-end">
                        <button 
                            onClick={() => setIsGuideOpen(true)} 
                            className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all active:scale-90"
                            title="Hướng dẫn nhanh"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
                                {/* KHUNG THÔNG BÁO ÂM THANH */}
           {showAudioWarning && (
                <div className="absolute bottom-[90px] left-1/2 -translate-x-1/2 w-[90%] max-w-[340px] bg-gray-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 border border-gray-700">
                    <div className="flex flex-col">
                        
                        {/* Tiêu đề: Căn giữa (thêm text-center) */}
                        <span className="text-center text-[11px] font-black text-amber-400 uppercase tracking-widest mb-1">
                            Lưu ý âm thanh
                        </span>
                        
                        {/* Nội dung: Căn lề trái (thêm text-left) */}
                        <span className="text-left text-[13px] leading-relaxed font-medium text-gray-200 mt-2 mb-4">
                            Nếu không nghe thấy tiếng, hãy đảm bảo máy đã tắt <b className="text-white">Chế độ Im lặng</b> và thử <b className="text-white">tăng âm lượng</b> lên nhé!
                        </span>
                        
                        {/* Nút bấm */}
                        <button onClick={closeAudioWarning} className="w-full py-2.5 bg-white text-gray-900 text-[11px] font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all shadow-sm">
                            Đã hiểu
                        </button>

                    </div>
                    {/* Tam giác nhỏ trỏ xuống dưới */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900/95"></div>
                </div>
            )}
{/* MODAL HƯỚNG DẪN KAIWA (GỌN NHẸ) */}
            {isGuideOpen && (
                <div 
                    className="fixed inset-0 z-[700] flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
                    onClick={() => setIsGuideOpen(false)}
                >
                    <div 
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-[380px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-200 cursor-default" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center shrink-0">
                            <h3 className="font-black text-sm text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Hướng dẫn nhanh
                            </h3>
                            <button onClick={() => setIsGuideOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all shadow-sm">✕</button>
                        </div>

                        {/* Content (Đã bỏ overflow-y-auto và flex-1 để ôm sát nội dung) */}
                        <div className="p-5 space-y-5">
                            
                            {/* 1. Xử lý sự cố âm thanh */}
                            <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl">
                                <h4 className="text-xs font-black text-zinc-900 uppercase mb-2 flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                    Lưu ý Âm thanh
                                </h4>
                                <p className="text-sm text-zinc-600 font-medium leading-relaxed">
                                    Không nghe thấy tiếng? Hãy kiểm tra xem điện thoại có đang bật <b>"Chế độ Im lặng"</b> (Gạt rung) không, nếu có thì hãy tắt nó đi và thử <b>tăng âm lượng</b> nhé.
                                </p>
                            </div>

                            {/* 2. Tính năng Luyện tập (Đã xóa tiêu đề và các mục dư thừa) */}
                            <div>
                                <ul className="space-y-3">
                                    <li className="flex gap-3 items-start p-3 bg-white border border-zinc-100 rounded-xl shadow-sm hover:border-zinc-300 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                                        </div>
                                        <div>
                                            <span className="block text-sm font-bold text-zinc-900 mb-0.5 leading-tight">Phát lại một câu</span>
                                            <span className="block text-xs text-zinc-500 font-medium leading-relaxed">Bấm trực tiếp vào <b>câu thoại</b>, hệ thống sẽ tự tua và đọc lại.</span>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-zinc-100 bg-white shrink-0">
                            <button 
                                onClick={() => setIsGuideOpen(false)}
                                className="w-full py-3.5 bg-zinc-900 hover:bg-black text-white text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95 uppercase tracking-widest"
                            >
                                Đã rõ, Đóng lại
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
const KanjiDictionaryModal = ({ isOpen, onClose, dbData, config, setConfig, setPracticeMode }) => {
    const [view, setView] = useState('radicals'); // 'radicals' | 'kanji_list' | 'detail'
    const [selectedRadical, setSelectedRadical] = useState(null);
    const [selectedKanji, setSelectedKanji] = useState(null);
    const [relatedVocab, setRelatedVocab] = useState([]);
    const [replayKey, setReplayKey] = useState(0); 
    const [strokeNumbers, setStrokeNumbers] = useState([]);

    // State mới để lưu danh sách Kanji tìm kiếm thủ công
    const [customKanjiList, setCustomKanjiList] = useState(null);

    const [visitedRadicals, setVisitedRadicals] = useState(new Set());
    const [visitedKanjis, setVisitedKanjis] = useState(new Set());
    
    const scrollRef = useRef(null); 
    const scrollPositions = useRef({ radicals: 0, kanji_list: 0 }); 

    const handleScroll = (e) => {
        if (view === 'radicals' || view === 'kanji_list') {
            scrollPositions.current[view] = e.target.scrollTop;
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            if (view === 'radicals') {
                scrollRef.current.scrollTop = scrollPositions.current.radicals;
            } else if (view === 'kanji_list') {
                scrollRef.current.scrollTop = scrollPositions.current.kanji_list;
            } else {
                scrollRef.current.scrollTop = 0; 
            }
        }
    }, [view]);

    // --- KHÓA NỀN CỐ ĐỊNH CHỐNG TRÔI TRÊN MOBILE ---
    useEffect(() => {
        if (isOpen) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
        } else {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = '';
            
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
            
            setView('radicals');
            setSelectedRadical(null);
            setSelectedKanji(null);
            setCustomKanjiList(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (view === 'detail' && selectedKanji && dbData?.TUVUNG_DB) {
            const matches = [];
            Object.entries(dbData.TUVUNG_DB).forEach(([word, info]) => {
                if (word.includes(selectedKanji)) {
                    let formattedMeaning = info.meaning || '';
                    if (formattedMeaning.length > 0) {
                        formattedMeaning = formattedMeaning.charAt(0).toUpperCase() + formattedMeaning.slice(1);
                    }
                    matches.push({ word, reading: info.reading, meaning: formattedMeaning });
                }
            });
            matches.sort((a, b) => a.word.length - b.word.length);
            setRelatedVocab(matches);
        }
    }, [view, selectedKanji, dbData]);

    const { paths, fullSvg } = useKanjiSvg(selectedKanji || '');

    useEffect(() => {
        if (fullSvg) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(fullSvg, "image/svg+xml");
            const textElements = Array.from(doc.querySelectorAll('text'));
            const numbers = textElements.map(t => ({
                value: t.textContent,
                transform: t.getAttribute('transform')
            }));
            setStrokeNumbers(numbers);
        } else {
            setStrokeNumbers([]);
        }
    }, [fullSvg]);

    if (!isOpen) return null;

    const handleAddKanji = () => {
        if (!selectedKanji) return;
        if (setPracticeMode) setPracticeMode('kanji');
        const currentText = config?.text || '';
        if (!currentText.includes(selectedKanji)) {
            setConfig({ ...config, text: currentText + selectedKanji });
        }
    };

    // --- HÀM XỬ LÝ KHI NGƯỜI DÙNG SEARCH KANJI BẰNG TAY TỪ SEARCH BAR ---
    const handleKanjiSearch = (kanjiStr) => {
        if(document.activeElement) document.activeElement.blur();
        scrollPositions.current.kanji_list = 0; // Reset scroll cho màn hình list

        if (kanjiStr.length === 1) {
            // Nhập 1 chữ -> Vào thẳng chi tiết
            setSelectedRadical(null);
            setCustomKanjiList(null);
            setSelectedKanji(kanjiStr);
            setVisitedKanjis(prev => new Set(prev).add(kanjiStr)); 
            setReplayKey(prev => prev + 1);
            setView('detail');
        } else {
            // Nhập >= 2 chữ -> Vào màn hình danh sách 
            setSelectedRadical(null);
            setCustomKanjiList(Array.from(kanjiStr));
            setView('kanji_list');
        }
    };

    // --- MÀN 1: TÌM KIẾM & DANH SÁCH BỘ THỦ ---
    const renderRadicals = () => {
        const radicals = dbData?.BOTHU_DB || {}; 
        const radicalList = Object.entries(radicals);

        return (
            <div className="flex flex-col h-full bg-zinc-50 overflow-hidden w-full">
                <div className="p-4 sm:p-6 bg-white border-b border-zinc-200 shrink-0">
                    <SearchBar 
                        mode="kanji" 
                        dbData={dbData} 
                        isDictionary={true} // Bật cờ Dictionary để nhận UI đặc biệt
                        onKanjiSearch={handleKanjiSearch} // Callback khi search Kanji
                        onSelectResult={(item) => {
                            if(document.activeElement) document.activeElement.blur();
                            setSelectedRadical(null);
                            setCustomKanjiList(null);
                            setSelectedKanji(item.char);
                            setVisitedKanjis(prev => new Set(prev).add(item.char));
                            setReplayKey(prev => prev + 1);
                            setView('detail');
                        }} 
                    />
                </div>

                <div 
                    ref={scrollRef} 
                    onScroll={handleScroll}
                    className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 w-full"
                >
                    <div className="flex items-center gap-2 mb-4 w-full">
                        <span className="w-2 h-2 rounded-full bg-zinc-300"></span>
                        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">Tra cứu theo bộ thủ</h3>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 w-full pb-8">
                        {radicalList.map(([rad, info]) => {
                            const isVisited = visitedRadicals.has(rad);
                            return (
                                <button 
                                    key={rad}
                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                    onClick={(e) => {
                                        e.currentTarget.blur();
                                        scrollPositions.current.kanji_list = 0; 
                                        setCustomKanjiList(null); // Clear search list
                                        setSelectedRadical({ radical: rad, ...info });
                                        setVisitedRadicals(prev => new Set(prev).add(rad)); 
                                        setTimeout(() => { setView('kanji_list'); }, 50);
                                    }}
                                    className={`border rounded-2xl p-4 flex flex-col items-center justify-center transition-all hover:-translate-y-1 active:scale-95 group outline-none ${
                                        isVisited ? 'bg-purple-50 border-purple-200 md:hover:border-purple-500' : 'bg-white border-zinc-200 md:hover:border-zinc-900 md:hover:shadow-md'
                                    }`}
                                >
                                    <span className={`text-3xl font-['Klee_One'] font-black mb-2 ${isVisited ? 'text-purple-600' : 'text-zinc-900 group-hover:text-black'}`}>{rad}</span>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest text-center line-clamp-1 w-full pb-0.5 ${isVisited ? 'text-purple-500' : 'text-zinc-500'}`}>{info.name || 'Bộ thủ'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // --- MÀN 2: DANH SÁCH KANJI THUỘC BỘ HOẶC TÌM KIẾM ---
    const renderKanjiList = () => {
        // NẾU KHÔNG CÓ BỘ THỦ CHỌN VÀ KHÔNG CÓ LIST SEARCH THÌ BỎ QUA
        if (!selectedRadical && !customKanjiList) return null;
        
        // Gắn mảng chars tuỳ theo người dùng đang xem Bộ thủ hay xem List Search
        const chars = customKanjiList || selectedRadical.chars || [];

        const groups = { N5: [], N4: [], N3: [], N2: [], N1: [], Khác: [] };
        chars.forEach(char => {
            let foundLevel = 'Khác';
            if (dbData?.KANJI_LEVELS) {
                if (dbData.KANJI_LEVELS.N5?.includes(char)) foundLevel = 'N5';
                else if (dbData.KANJI_LEVELS.N4?.includes(char)) foundLevel = 'N4';
                else if (dbData.KANJI_LEVELS.N3?.includes(char)) foundLevel = 'N3';
                else if (dbData.KANJI_LEVELS.N2?.includes(char)) foundLevel = 'N2';
                else if (dbData.KANJI_LEVELS.N1?.includes(char)) foundLevel = 'N1';
            }
            groups[foundLevel].push(char);
        });

        return (
            <div 
                ref={scrollRef} 
                onScroll={handleScroll}
                className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-white w-full"
            >
                <div className="flex items-center gap-4 mb-6 border-b border-zinc-100 pb-4">
                    {customKanjiList ? (
                        <>
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest pb-1">KẾT QUẢ TÌM KIẾM</span>
                                <span className="text-lg font-black text-indigo-600">{chars.length} Kanji</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-5xl font-['Klee_One'] font-black text-zinc-900 bg-zinc-50 border border-zinc-200 p-2 rounded-xl">{selectedRadical.radical}</span>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest pb-1">Bộ {selectedRadical.name}</span>
                                <span className="text-lg font-black text-indigo-600">{chars.length} Kanji</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-6 pb-8">
                    {['N5', 'N4', 'N3', 'N2', 'N1', 'Khác'].map(level => {
                        if (groups[level].length === 0) return null;
                        return (
                            <div key={level}>
                                <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-3">CẤP ĐỘ {level} ({groups[level].length})</h4>
                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                                    {groups[level].map(char => {
                                        const info = dbData?.KANJI_DB?.[char] || {};
                                        const isVisited = visitedKanjis.has(char); 
                                        
                                        return (
                                            <button 
                                                key={char}
                                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                                onClick={(e) => {
                                                    e.currentTarget.blur();
                                                    setSelectedKanji(char);
                                                    setVisitedKanjis(prev => new Set(prev).add(char)); 
                                                    setReplayKey(prev => prev + 1);
                                                    setTimeout(() => { setView('detail'); }, 50);
                                                }}
                                                className={`border rounded-xl p-3 flex flex-col items-center justify-center transition-all hover:-translate-y-1 active:scale-95 group outline-none ${
                                                    isVisited ? 'bg-purple-50 border-purple-200 md:hover:border-purple-500' : 'bg-white border-zinc-200 md:hover:border-zinc-900 md:hover:shadow-md'
                                                }`}
                                            >
                                                <span className={`text-2xl font-['Klee_One'] font-black mb-1 ${isVisited ? 'text-purple-600' : 'text-zinc-900 group-hover:text-black'}`}>
                                                    {char}
                                                </span>
                                                <span className={`text-[9px] font-bold uppercase line-clamp-1 w-full text-center pb-0.5 ${isVisited ? 'text-purple-400' : 'text-zinc-500'}`}>
                                                    {info.sound || '---'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // --- MÀN 3: CHI TIẾT KANJI (Giữ nguyên gốc) ---
    const renderDetail = () => {
        const info = dbData?.KANJI_DB?.[selectedKanji] || {};
        const onkun = dbData?.ONKUN_DB?.[selectedKanji] || {};

        return (
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-50 w-full flex flex-col">
                <div className="p-4 sm:p-6 bg-white border-b border-zinc-200 flex flex-col md:flex-row gap-6">
                    {/* Ô vẽ Kanji */}
                    <div className="w-full md:w-56 h-56 border border-zinc-200 rounded-2xl flex items-center justify-center bg-white shadow-inner relative overflow-hidden shrink-0">
                        {paths.length > 0 ? (
                            <svg key={replayKey} viewBox="0 0 109 109" className="w-[85%] h-[85%] p-2">
                                {strokeNumbers.map((num, idx) => (
                                    <text key={`num-${idx}`} transform={num.transform} className="stroke-number text-[10px] font-sans fill-gray-400" style={{ animationDelay: `${0.4 + (idx * 0.6)}s` }}>
                                        {num.value}
                                    </text>
                                ))}
                                {paths.map((d, index) => (
                                    <path key={index} d={d} className="stroke-anim-path" style={{ animationDuration: '3s', animationDelay: `${0.4 + (index * 0.6)}s`, stroke: '#1a1a1a', strokeWidth: 3 }} />
                                ))}
                            </svg>
                        ) : (
                            <span className="text-7xl font-['Klee_One'] text-zinc-900">{selectedKanji}</span>
                        )}
                        <button style={{ WebkitTapHighlightColor: 'transparent' }} onClick={(e) => { e.currentTarget.blur(); setReplayKey(prev => prev + 1); }} className="absolute bottom-2 right-2 p-2 bg-white rounded-full shadow-md border border-zinc-200 text-zinc-600 hover:text-black active:scale-90 transition-all outline-none" title="Vẽ lại">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                        </button>
                    </div>

                    {/* Thông tin Text */}
                    <div className="flex-1 flex flex-col justify-center min-w-0 w-full mt-4 md:mt-0">
                        <div className="mb-4 w-full text-center md:text-left">
                            <h2 className="text-3xl font-black text-zinc-900 uppercase tracking-widest mb-1 truncate w-full pb-1">{info.sound || '---'}</h2>
                            <p className="text-base md:text-lg font-medium text-zinc-500 italic line-clamp-2 w-full leading-relaxed pb-1" title={info.meaning || onkun.meanings?.join(', ')}>
                                {info.meaning || onkun.meanings?.join(', ') || 'Chưa có dữ liệu nghĩa'}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
                            <div className="bg-zinc-100 p-3 rounded-xl border border-zinc-200 min-w-0 w-full">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">ÂM ON</span>
                                <span className="text-sm font-bold text-zinc-900 block truncate w-full pb-0.5" title={onkun.readings_on?.join('、 ')}>
                                    {onkun.readings_on && onkun.readings_on.length > 0 ? onkun.readings_on.join('、 ') : '---'}
                                </span>
                            </div>
                            <div className="bg-zinc-100 p-3 rounded-xl border border-zinc-200 min-w-0 w-full">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">ÂM KUN</span>
                                <span className="text-sm font-bold text-zinc-900 block truncate w-full pb-0.5" title={onkun.readings_kun?.join('、 ')}>
                                    {onkun.readings_kun && onkun.readings_kun.length > 0 ? onkun.readings_kun.join('、 ') : '---'}
                                </span>
                            </div>
                        </div>
                        
                        <div className="mt-4 flex gap-2 w-full justify-center md:justify-start items-center">
                            {onkun.jlpt_new && <span className="px-2 py-1 bg-zinc-900 text-white text-[10px] font-black rounded uppercase flex-shrink-0">JLPT N{onkun.jlpt_new}</span>}
                            {onkun.strokes && <span className="px-2 py-1 border border-zinc-300 text-zinc-600 text-[10px] font-black rounded uppercase flex-shrink-0">{onkun.strokes} Nét</span>}

                            {selectedKanji && (
                                <button
                                    onClick={handleAddKanji}
                                    className={`flex items-center justify-center px-2.5 py-1 text-[10px] font-black rounded uppercase flex-shrink-0 transition-all active:scale-95 ml-1 ${
                                        config?.text?.includes(selectedKanji)
                                            ? 'bg-green-500 text-white border border-green-500 shadow-sm'
                                            : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                                    }`}
                                    title="Thêm vào danh sách ôn tập"
                                >
                                    {config?.text?.includes(selectedKanji) ? (
                                        <span className="flex items-center gap-1">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            Đã thêm
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            Thêm ôn tập
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Từ vựng đi kèm */}
                <div className="p-4 sm:p-6 w-full">
                    <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        Từ vựng thông dụng ({relatedVocab.length})
                    </h3>
                    
                    {relatedVocab.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
                            {relatedVocab.map((vocab, i) => (
                                <div key={i} className="p-3 bg-white border border-zinc-200 rounded-xl hover:border-zinc-400 transition-colors shadow-sm flex items-center justify-between w-full min-w-0">
                                    <div className="flex flex-col min-w-0 pr-3 flex-1 justify-center">
                                        <span className="text-base sm:text-lg font-bold text-zinc-900 line-clamp-1 w-full leading-normal pb-1" title={vocab.word}>{vocab.word}</span>
                                        <span className="text-[13px] sm:text-sm font-medium text-zinc-500 line-clamp-1 w-full leading-normal pb-1" title={vocab.meaning}>{vocab.meaning}</span>
                                    </div>
                                    <span className="text-[11px] sm:text-sm font-bold text-zinc-600 bg-zinc-100 px-2 sm:px-3 py-1.5 rounded-lg flex-shrink-0 max-w-[45%] line-clamp-1 leading-normal pb-1">
                                        {vocab.reading}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-zinc-400 text-sm font-medium pb-10">
                            Không tìm thấy từ vựng nào chứa chữ này trong dữ liệu hiện tại.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[600] flex justify-center items-center bg-zinc-900/90 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full h-full sm:max-w-4xl sm:h-[90vh] md:h-[90vh] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 sm:border border-zinc-200">
                
                {/* HEADER */}
                <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 bg-white flex justify-between items-center shrink-0 shadow-sm z-10 w-full">
                    <div className="flex items-center gap-3">
                        {view !== 'radicals' && (
                            <button 
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                onClick={(e) => {
                                    e.currentTarget.blur();
                                    
                                    // --- ĐIỀU HƯỚNG CHUẨN XÁC NÚT QUAY LẠI ---
                                    if (view === 'detail') {
                                        // Từ Detail quay lại List search hoặc Bộ thủ
                                        setView(selectedRadical || customKanjiList ? 'kanji_list' : 'radicals');
                                    } 
                                    else if (view === 'kanji_list') {
                                        // Từ List quay lại Bộ thủ gốc
                                        setView('radicals');
                                        setSelectedRadical(null); 
                                        setCustomKanjiList(null); // Clear search Kanji
                                    }
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors outline-none"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                        )}
                        <h2 className="text-base sm:text-lg font-black text-zinc-900 uppercase tracking-tight">
                            TRA CỨU KANJI
                        </h2>
                    </div>
                    <button style={{ WebkitTapHighlightColor: 'transparent' }} onClick={(e)=>{e.currentTarget.blur(); onClose();}} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-900 hover:text-white transition-all shadow-sm outline-none">✕</button>
                </div>

                {/* CONTENT AREA */}
                {view === 'radicals' && renderRadicals()}
                {view === 'kanji_list' && renderKanjiList()}
                {view === 'detail' && renderDetail()}
                
            </div>
        </div>
    );
};
// ==========================================
// 1. MODAL CHÍNH LỚN: QUẢN LÝ LUỒNG CHÉP CHÍNH TẢ
// ==========================================
const DictationModal = ({ isOpen, onClose }) => {
    const [view, setView] = React.useState('books'); // 'books' | 'parts' | 'practice'
    const [isLoading, setIsLoading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    
    // Data states
    const [bookCache, setBookCache] = React.useState({});
    const [partsList, setPartsList] = React.useState([]);
    const [selectedBookTitle, setSelectedBookTitle] = React.useState('');
    const [currentPartIndex, setCurrentPartIndex] = React.useState(0);

    // Kỹ thuật KHÓA NỀN ĐA NỀN TẢNG (Chống trượt tuyệt đối)
    React.useEffect(() => {
        if (isOpen) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
        } else {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = '';
            if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
            
            // Reset state khi đóng
            setView('books');
            setPartsList([]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // --- HÀM TẢI DỮ LIỆU SÁCH ---
    const handleLoadBook = async (bookId, bookTitle) => {
        setSelectedBookTitle(bookTitle);
        
        if (bookCache[bookId]) {
            setPartsList(bookCache[bookId]);
            setView('parts');
            return;
        }

        setIsLoading(true);
        setProgress(30);
        try {
            // Tải file JSON
            const response = await fetch(`./data/nghechinhta/${bookId}.json`);
            if (!response.ok) throw new Error("Lỗi tải data");
            const data = await response.json(); // data là mảng các phần (parts)
            
            setBookCache(prev => ({ ...prev, [bookId]: data }));
            setPartsList(data);
            
            setProgress(100);
            setTimeout(() => {
                setView('parts');
                setIsLoading(false);
            }, 400);

        } catch (error) {
            alert("Lỗi tải dữ liệu nghe! Hãy đảm bảo file json tồn tại.");
            setIsLoading(false);
            setProgress(0);
        }
    };

    // --- VIEW 1: DANH SÁCH SÁCH ---
    const renderBooks = () => (
        <div className="flex flex-col h-full bg-white overflow-hidden relative">
            {/* HEADER */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100 bg-white z-10 shadow-sm shrink-0">
                <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">Luyện Nghe Chính Tả</h2>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
            </div>
            
            {/* NỘI DUNG */}
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-4">
                    {/* Sách có sẵn */}
                    <button 
                        onClick={() => handleLoadBook('mimikaran3', 'Mimikara N3')}
                        className="w-full p-5 sm:p-6 bg-white border border-zinc-200 rounded-2xl hover:border-indigo-400 hover:shadow-md transition-all flex flex-col items-start active:scale-95 group relative overflow-hidden"
                    >
                        <div className="flex justify-between items-center w-full gap-4">
                            <span className="text-lg sm:text-xl font-black text-zinc-900 uppercase text-left leading-tight group-hover:text-indigo-600 transition-colors">
                                Mimikara N3
                            </span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-zinc-500 mt-1.5 text-left">Luyện chép chính tả & phản xạ nghe</span>
                    </button>

                    {/* Sách chờ cập nhật */}
                    <button disabled className="w-full p-5 sm:p-6 bg-zinc-50/50 border border-zinc-100 rounded-2xl flex flex-col items-start cursor-not-allowed opacity-60 relative overflow-hidden">
                        <div className="absolute top-4 right-4 bg-zinc-200 text-zinc-500 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                            Sắp ra mắt
                        </div>
                        <div className="flex justify-between items-center w-full">
                            <span className="text-lg sm:text-xl font-black text-zinc-400 uppercase text-left leading-tight">Mimikara N2</span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-zinc-400 mt-1.5 text-left">Đang cập nhật dữ liệu...</span>
                    </button>
                </div>
            </div>
        </div>
    );

    // --- VIEW 2: DANH SÁCH BÀI (PARTS) ---
    const renderParts = () => (
        <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
            <div className="p-4 bg-white border-b border-zinc-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView('books')} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors outline-none">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <h2 className="text-sm font-black text-zinc-900 uppercase">{selectedBookTitle}</h2>
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-500 transition-all outline-none">✕</button>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
                {partsList.map((part, idx) => (
                    <button 
                        key={idx}
                        onClick={() => { setCurrentPartIndex(idx); setView('practice'); }}
                        className="w-full p-4 sm:p-5 bg-white border border-zinc-200 rounded-xl text-left md:hover:border-indigo-400 md:hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-between group outline-none"
                    >
                        <div className="flex flex-col">
                            <span className="text-base sm:text-lg font-black text-zinc-800 font-sans md:group-hover:text-indigo-600 transition-colors uppercase tracking-wide">{part.title}</span>
                            <span className="text-xs font-bold text-zinc-400 mt-1">{part.vocabularies?.length || 0} từ vựng</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center md:group-hover:bg-indigo-50 transition-colors">
                            <svg className="w-4 h-4 text-zinc-400 md:group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[500] flex justify-center items-center bg-zinc-900/90 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full h-full sm:h-[90vh] max-w-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* HIỂU ỨNG LOADING */}
                {isLoading && (
                    <div className="absolute inset-0 z-[600] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md">
                        <div className="text-center">
                            <span className="text-xs font-bold text-zinc-900 uppercase tracking-widest animate-pulse mb-4 block">
                                Đang tải dữ liệu... {progress}%
                            </span>
                            <div className="w-48 bg-zinc-200 rounded-full h-1.5 overflow-hidden mx-auto">
                                <div className="bg-zinc-900 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    </div>
                )}
                
                {view === 'books' && renderBooks()}
                {view === 'parts' && renderParts()}
                {view === 'practice' && (
                    <DictationPracticeView 
                        lessonData={partsList[currentPartIndex]} 
                        onBack={() => setView('parts')}
                        onClose={onClose}
                    />
                )}
            </div>
        </div>
    );
};

// ==========================================
// 2. COMPONENT LUYỆN TẬP CHÍNH (DICTATION GAME)
// ==========================================
const DictationPracticeView = ({ lessonData, onBack, onClose }) => {
    // State bài học
    const [queue, setQueue] = React.useState([]); 
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [status, setStatus] = React.useState('idle'); // 'idle' | 'correct' | 'wrong' | 'retyping'
    const [userInput, setUserInput] = React.useState('');
    const [finished, setFinished] = React.useState(false);
    const [wrongCount, setWrongCount] = React.useState(0); 
    const [wrongDetected, setWrongDetected] = React.useState(false); // Đánh dấu đã sai để đẩy xuống cuối
    
    // State tính năng
    const [mode, setMode] = React.useState('word'); // 'word' | 'sentence'
    const [showVi, setShowVi] = React.useState(false); 
    const [showHint, setShowHint] = React.useState(false); 
    const [isLooping, setIsLooping] = React.useState(false); 
    const [playbackRate, setPlaybackRate] = React.useState(1); // Tốc độ phát

    // State Audio
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isAudioLoaded, setIsAudioLoaded] = React.useState(false);
    const [isAudioLoading, setIsAudioLoading] = React.useState(false);
    
    const soundRef = React.useRef(null);
    const loopTimerRef = React.useRef(null);

    // Dùng Ref để Callback của Howler không bị dính closure (lấy nhầm data cũ)
    const currentIndexRef = React.useRef(currentIndex);
    const queueRef = React.useRef(queue);
    const modeRef = React.useRef(mode);

    React.useEffect(() => {
        currentIndexRef.current = currentIndex;
        queueRef.current = queue;
        modeRef.current = mode;
    }, [currentIndex, queue, mode]);

    // --- 1. KHỞI TẠO BÀI HỌC (CHƯA LOAD AUDIO) ---
    const initLesson = React.useCallback(() => {
        clearTimeout(loopTimerRef.current);
        if (!lessonData || !lessonData.vocabularies) return;

        setIsAudioLoaded(false);
        setIsAudioLoading(false);
        if (soundRef.current) {
            soundRef.current.unload();
            soundRef.current = null;
        }

        const shuffled = [...lessonData.vocabularies].sort(() => Math.random() - 0.5);
        setQueue(shuffled);
        setCurrentIndex(0);
        setStatus('idle');
        setUserInput('');
        setFinished(false);
        setShowHint(false);
        setWrongCount(0);
        setWrongDetected(false);

    }, [lessonData]);

    React.useEffect(() => {
        initLesson();
        return () => {
            clearTimeout(loopTimerRef.current);
            if (soundRef.current) {
                soundRef.current.unload();
                soundRef.current = null;
            }
        };
    }, [initLesson]);

    // --- 2. HÀM TẢI (LAZY LOAD) VÀ PHÁT AUDIO ---
    // --- 2. HÀM TẢI (LAZY LOAD) VÀ PHÁT AUDIO ---
    const playCurrentAudio = React.useCallback(() => {
        if (queueRef.current.length === 0) return;

        // NẾU CHƯA LOAD FILE AUDIO -> BẮT ĐẦU LOAD
        if (!soundRef.current) {
            if (isAudioLoading) return; // Tránh spam load nhiều lần
            setIsAudioLoading(true);

            const spriteData = {};
            lessonData.vocabularies.forEach(item => {
                if (item.wordStartTime !== undefined && item.wordEndTime !== undefined) {
                    spriteData[`${item.id}_word`] = [item.wordStartTime * 1000, (item.wordEndTime - item.wordStartTime) * 1000];
                }
                if (item.sentenceStartTime !== undefined && item.sentenceEndTime !== undefined) {
                    spriteData[`${item.id}_sentence`] = [item.sentenceStartTime * 1000, (item.sentenceEndTime - item.sentenceStartTime) * 1000];
                }
            });

            soundRef.current = new Howl({
                src: [lessonData.audioPath],
                sprite: spriteData,
                // html5: true, // Xóa hoặc comment dòng này đi nếu âm thanh bị lỗi/chập chờn trên điện thoại
                preload: true,
                onload: function() {
                    setIsAudioLoaded(true);
                    setIsAudioLoading(false);
                    this.rate(playbackRate); // Áp dụng tốc độ
                    
                    // --- LOGIC: Phát ngay lập tức khi load xong ---
                    const currentItem = queueRef.current[currentIndexRef.current];
                    const hasSentenceData = currentItem.sentence && currentItem.sentence.trim() !== '' && currentItem.sentenceStartTime !== undefined && currentItem.sentenceEndTime !== undefined;
                    const actualMode = (modeRef.current === 'sentence' && hasSentenceData) ? 'sentence' : 'word';
                    const spriteKey = `${currentItem.id}_${actualMode}`;
                    
                    this.play(spriteKey);
                },
                onplay: () => setIsPlaying(true),
                onend: () => setIsPlaying(false),
                onstop: () => setIsPlaying(false),
                onloaderror: () => {
                    alert("Lỗi tải file âm thanh! Hãy kiểm tra lại đường truyền.");
                    setIsAudioLoaded(false);
                    setIsAudioLoading(false);
                }
            });
            return;
        }

        // NẾU ĐÃ LOAD XONG RỒI -> CHỈ VIỆC PHÁT
        if (!isAudioLoaded) return;
        const currentItem = queueRef.current[currentIndexRef.current];
        
        // --- LOGIC: Chọn sprite key đúng ---
        const hasSentenceData = currentItem.sentence && currentItem.sentence.trim() !== '' && currentItem.sentenceStartTime !== undefined && currentItem.sentenceEndTime !== undefined;
        const actualMode = (modeRef.current === 'sentence' && hasSentenceData) ? 'sentence' : 'word';
        const spriteKey = `${currentItem.id}_${actualMode}`;
        
        soundRef.current.stop(); 
        soundRef.current.play(spriteKey);
    }, [lessonData, isAudioLoaded, isAudioLoading, playbackRate]);

    // Auto-play khi chuyển câu (CHỈ KHI AUDIO ĐÃ ĐƯỢC USER KHỞI ĐỘNG LOAD TRƯỚC ĐÓ)
    React.useEffect(() => {
        if (!finished && queue.length > 0 && isAudioLoaded && soundRef.current) {
            const timer = setTimeout(() => {
                playCurrentAudio();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, finished, mode, playCurrentAudio, isAudioLoaded, queue.length]);

    // Vòng lặp
    React.useEffect(() => {
        if (!isPlaying && isLooping && !finished && isAudioLoaded) {
            loopTimerRef.current = setTimeout(() => {
                playCurrentAudio();
            }, 500);
        }
        return () => clearTimeout(loopTimerRef.current);
    }, [isPlaying, isLooping, finished, isAudioLoaded, playCurrentAudio]);

    // Cập nhật tốc độ audio
    React.useEffect(() => {
        if (soundRef.current) soundRef.current.rate(playbackRate);
    }, [playbackRate]);

    const cyclePlaybackRate = () => {
        const rates = [0.5, 0.75, 1, 1.25, 1.5];
        const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
        setPlaybackRate(rates[nextIdx]);
    };

    // --- 3. XỬ LÝ NHẬP LIỆU & CHẤM ĐIỂM ---
    const handleInputChange = (e) => {
        setUserInput(convertToKana(e.target.value, false)); 
    };

    const handleHelp = () => {
        const currentItem = queue[currentIndex];
        
        // Bấm trợ giúp cũng tính là sai -> Đẩy xuống cuối danh sách nếu chưa bị đẩy
        if (!wrongDetected) {
            setQueue(prev => [...prev, currentItem]);
            setWrongDetected(true);
        }

        setShowHint(true);
        setStatus('retyping');
        setUserInput('');
        playCurrentAudio(); // Play lại file nghe ngay lập tức
    };

    const checkAnswer = () => {
        if (status === 'correct' || finished) return;
        const currentItem = queue[currentIndex];
        let finalInput = userInput.trim();

        if (finalInput.endsWith('n')) {
            finalInput = finalInput.slice(0, -1) + 'ん';
        }

        const isCorrect = (finalInput === currentItem.word) || (finalInput === currentItem.reading);

        // Đang bị phạt gõ lại
        if (status === 'retyping') {
            if (isCorrect) goToNext();
            else {
                setStatus('wrong');
                playCurrentAudio();
                setTimeout(() => setStatus('retyping'), 400);
            }
            return;
        }

        if (isCorrect) {
            setStatus('correct');
            setWrongCount(0); 
            clearTimeout(loopTimerRef.current);
            setTimeout(() => goToNext(), 600);
        } else {
            const newWrongCount = wrongCount + 1;
            setWrongCount(newWrongCount);
            setStatus('wrong');
            playCurrentAudio(); 
            
            // Lần ĐẦU TIÊN sai -> Đẩy câu này xuống cuối danh sách phát
            if (!wrongDetected) {
                setQueue(prev => [...prev, currentItem]);
                setWrongDetected(true);
            }

            // Sai 5 lần -> Bắt gõ lại
            if (newWrongCount >= 5) {
                setTimeout(() => {
                    setShowHint(true);
                    setStatus('retyping');
                }, 500);
            } else {
                setTimeout(() => setStatus('idle'), 500); 
            }
        }
    };

    const goToNext = () => {
        clearTimeout(loopTimerRef.current);
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserInput('');
            setStatus('idle');
            setShowHint(false);
            setWrongCount(0);
            setWrongDetected(false); // Trả lại trạng thái cho câu mới
        } else {
            setFinished(true);
        }
    };

    const triggerConfetti = React.useCallback(() => {
        if (typeof confetti === 'undefined') return;
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 2000 });
    }, []);

    React.useEffect(() => { if (finished) triggerConfetti(); }, [finished, triggerConfetti]);

    // --- RENDER ĐỤC LỖ CÂU VÍ DỤ ---
    const renderMaskedSentence = (sentence, word, reading) => {
        if (!sentence || !word) return null;
        const parts = sentence.split(word);
        if (parts.length === 1) return <span className="font-sans">{sentence}</span>; 
        
        return (
            <span className="font-sans leading-loose">
                {parts[0]}
                <span className={`px-2 mx-1 border-b-2 transition-colors inline-flex flex-col items-center justify-end align-bottom ${showHint || status === 'retyping' ? 'text-indigo-600 border-indigo-600' : 'text-zinc-300 border-zinc-400'}`}>
                    {showHint || status === 'retyping' ? (
                        <span className="font-bold whitespace-nowrap">{word} ({reading})</span>
                    ) : '＿＿＿'}
                </span>
                {parts.slice(1).join(word)}
            </span>
        );
    };

    if (queue.length === 0) return null;
    const currentItem = queue[currentIndex];

    // --- CODE MỚI: XÁC ĐỊNH CHẾ ĐỘ THỰC TẾ CHO UI ---
    const hasSentenceText = currentItem.sentence && currentItem.sentence.trim() !== '' && currentItem.sentenceStartTime !== undefined && currentItem.sentenceEndTime !== undefined;
    const effectiveMode = (mode === 'sentence' && hasSentenceText) ? 'sentence' : 'word';

    // Tính toán kích thước nút Play động dựa trên Nội dung đang hiển thị
    // Sửa 'mode' thành 'effectiveMode'
    const isShowingText = effectiveMode === 'sentence' || showHint || status === 'retyping';
    let playBtnSize = "w-24 h-24 sm:w-28 sm:h-28"; 
    let playIconSize = "w-10 h-10 sm:w-12 sm:h-12";
    
    if (isShowingText && showVi) {
        playBtnSize = "w-14 h-14 sm:w-16 sm:h-16"; 
        playIconSize = "w-6 h-6 sm:w-7 sm:h-7";
    } else if (isShowingText || showVi) {
        playBtnSize = "w-16 h-16 sm:w-20 sm:h-20"; 
        playIconSize = "w-7 h-7 sm:w-8 sm:h-8";
    }
    return (
        <div className="flex flex-col h-full bg-white overflow-hidden relative">
            {/* 1. HEADER (Top bar) */}
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between z-10 shrink-0">
                <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 px-2 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors outline-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    QUAY LẠI
                </button>
                <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-black text-zinc-800 tracking-widest bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200">
                    {currentIndex + 1} / {queue.length}
                </span>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-500 transition-all outline-none">✕</button>
            </div>

            {/* 2. BODY CONTENT */}
            {!finished ? (
                // LƯU Ý pb-6 sm:pb-10: Nhích khung nhập liệu lên một chút khỏi mép dưới
                <div className="flex-1 flex flex-col p-4 sm:p-6 w-full h-full relative pb-6 sm:pb-10">
                    
                    {/* BỘ ĐIỀU KHIỂN (Cố định ở trên) */}
                    <div className="w-full max-w-md mx-auto mb-2 flex flex-wrap gap-2 justify-center bg-zinc-50 p-1.5 rounded-2xl border border-zinc-100 shadow-sm shrink-0">
                        <div className="flex bg-zinc-200/50 p-1 rounded-xl">
                            <button onClick={() => setMode('word')} className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all outline-none ${mode === 'word' ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'}`}>TỪ ĐƠN</button>
                            <button onClick={() => setMode('sentence')} className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all outline-none ${mode === 'sentence' ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'}`}>CẢ CÂU</button>
                        </div>

                        <button onClick={() => setShowVi(!showVi)} className={`px-3 sm:px-4 py-1.5 rounded-xl text-[10px] font-bold border transition-all shadow-sm outline-none ${showVi ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100'}`}>
                            DỊCH
                        </button>
                        
                        <button onClick={() => setIsLooping(!isLooping)} className={`px-3 sm:px-4 py-1.5 rounded-xl text-[10px] font-bold border transition-all shadow-sm outline-none ${isLooping ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100'}`}>
                            LẶP
                        </button>

                        {/* NÚT TỐC ĐỘ XUỐNG CUỐI CÙNG */}
                        <button onClick={cyclePlaybackRate} className="px-3 sm:px-4 py-1.5 rounded-xl text-[10px] font-bold border transition-all shadow-sm outline-none bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100">
                            {playbackRate}x
                        </button>
                    </div>

                    {/* VÙNG TRUNG TÂM: Co giãn linh hoạt, Tự động chia đều không gian ở chính giữa */}
                    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto gap-4 sm:gap-5 transition-all duration-300">
                        
                        {/* NÚT PHÁT ÂM THANH ĐỘNG */}
                        <div className={`transition-all duration-300 shrink-0 ${status === 'correct' ? 'scale-110 opacity-50' : status === 'wrong' ? 'animate-shake' : ''}`}>
                            <button 
                                onClick={playCurrentAudio}
                                className={`${playBtnSize} rounded-full flex items-center justify-center shadow-md transition-all duration-300 active:scale-90 outline-none ${isAudioLoading ? 'bg-zinc-200 cursor-wait' : isPlaying ? 'bg-indigo-600 text-white shadow-indigo-300 animate-pulse' : 'bg-zinc-900 text-white hover:bg-black'}`}
                            >
                                {isAudioLoading ? (
                                    <div className="flex space-x-1">
                                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                                    </div>
                                ) : isPlaying ? (
                                    <svg className={playIconSize} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>
                                ) : (
                                    <svg className={`${playIconSize} ml-1`} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 19 12 6 20 6 4"></polygon></svg>
                                )}
                            </button>
                        </div>

                        {/* HIỂN THỊ CHỮ HOẶC CÂU VÍ DỤ */}
{isShowingText && (
    <div className="w-full flex justify-center animate-in fade-in zoom-in-95 duration-300">
        {effectiveMode === 'sentence' ? (     /* <--- ĐỔI Ở ĐÂY */
            <div className="text-lg sm:text-xl font-bold text-zinc-800 text-center w-full leading-relaxed px-2">
                {renderMaskedSentence(currentItem.sentence, currentItem.word, currentItem.reading)}
            </div>
        ) : (
            <div className="text-center flex flex-col items-center justify-center bg-indigo-50 border border-indigo-100 px-6 py-2.5 rounded-2xl">
                <span className="text-2xl sm:text-3xl font-black text-indigo-700 mb-0.5">{currentItem.word}</span>
                <span className="text-[11px] sm:text-xs font-bold text-indigo-500 tracking-widest">{currentItem.reading}</span>
            </div>
        )}
    </div>
)}

                        {/* HIỂN THỊ DỊCH NGHĨA */}
{showVi && (
    <p className="text-[13px] sm:text-sm font-medium text-zinc-500 text-center px-4 w-full max-w-md animate-in fade-in slide-in-from-bottom-2">
        {effectiveMode === 'sentence' ? currentItem.sentenceVi : currentItem.meaning}  {/* <--- ĐỔI Ở ĐÂY */}
    </p>
)}
                    </div>

                    {/* VÙNG NHẬP LIỆU (Cố định ở dưới cùng) */}
                    <div className="w-full max-w-md mx-auto shrink-0 space-y-2 mt-4">
                        <input 
                            type="text" autoFocus value={userInput} onChange={handleInputChange}
                            onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                            placeholder={status === 'retyping' ? "Nhập lại từ vựng" : "Nhập từ vựng"}
                            className={`w-full p-3.5 sm:p-4 text-center text-lg sm:text-xl font-bold border-2 rounded-2xl outline-none transition-all shadow-sm ${status === 'correct' ? 'border-green-500 bg-green-50 text-green-700 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : status === 'wrong' || status === 'retyping' ? 'border-red-500 bg-red-50 text-red-700 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-zinc-200 focus:border-indigo-500 bg-zinc-50'}`}
                        />
                        
                        <div className="flex justify-between items-center px-2">
                            <button onClick={handleHelp} disabled={showHint || status === 'retyping'} className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 outline-none ${showHint || status === 'retyping' ? 'text-zinc-300 cursor-not-allowed' : 'text-zinc-500 hover:text-indigo-600 active:scale-95'}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2v1"/><path d="M12 11v1"/><path d="M12 6a4 4 0 0 0-4 4c0 1.5.5 2 2 3 .5 1 .5 2 .5 3h3c0-1 0-2 .5-3 1.5-1 2-1.5 2-3a4 4 0 0 0-4-4Z"/></svg>
                                Trợ giúp
                            </button>
                            <span className="text-[9px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>
                                Enter
                            </span>
                        </div>
                    </div>

                </div>
            ) : (
                // 3. MÀN HÌNH KẾT THÚC
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="text-6xl mb-6 animate-bounce cursor-pointer hover:scale-125 transition-transform" onClick={triggerConfetti}>🎉</div>
                    <h3 className="text-2xl font-black text-zinc-900 mb-2 uppercase tracking-wide">XUẤT SẮC!</h3>
                    <p className="text-zinc-500 mb-8 text-sm font-medium">Bạn đã hoàn thành phần luyện tập chép chính tả.</p>
                    <div className="space-y-3 w-full max-w-xs">
                        <button onClick={initLesson} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] tracking-widest uppercase shadow-lg shadow-indigo-200 active:scale-95 transition-all outline-none">
                            HỌC LẠI TỪ ĐẦU
                        </button>
                        <button onClick={onBack} className="w-full py-4 bg-white border-2 border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-800 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 outline-none">
                            VỀ DANH SÁCH BÀI
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
const App = () => {
    // --- STATE QUẢN LÝ ỨNG DỤNG ---
    const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
    const [isLearnGameOpen, setIsLearnGameOpen] = useState(false);
    const [isReviewListOpen, setIsReviewListOpen] = useState(false);
    const [isPreviewListOpen, setIsPreviewListOpen] = useState(false);
    const [isEssayOpen, setIsEssayOpen] = useState(false);
    const [isVerbPreviewOpen, setIsVerbPreviewOpen] = useState(false);
    const [isVerbEssayOpen, setIsVerbEssayOpen] = useState(false);
    const [isVerbQuizOpen, setIsVerbQuizOpen] = useState(false);
    const [isVerbReflexOpen, setIsVerbReflexOpen] = useState(false);
    const [verbPracticeData, setVerbPracticeData] = useState([]);
    const [verbTargetForm, setVerbTargetForm] = useState(null);
    const [globalVerbReadings, setGlobalVerbReadings] = useState({});
    const [isKaiwaOpen, setIsKaiwaOpen] = useState(false);
    const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  // THÊM MỚI Ở ĐÂY: State cho Nghe chính tả
    const [isDictationMenuOpen, setIsDictationMenuOpen] = useState(false);
    const [isDictationGameOpen, setIsDictationGameOpen] = useState(false);
    const [dictationData, setDictationData] = useState([]);
    const [dictationAudioPath, setDictationAudioPath] = useState('');
    const [dictationMode, setDictationMode] = useState('word');
    
    // STATE MỚI CHO TÍNH NĂNG TRẮC NGHIỆM ĐỘNG TỪ
const [verbPracticeMode, setVerbPracticeMode] = useState('essay'); // 'essay' (tự luận) hoặc 'quiz' (trắc nghiệm)
const [verbSelectedForms, setVerbSelectedForms] = useState([]); // Mảng lưu các thể đã chọn (ít nhất 4)
    // State cho Modal Thiết lập (StudySetupModal)
    const [setupConfig, setSetupConfig] = useState({ isOpen: false, targetAction: null });
  
    const [practiceMode, setPracticeMode] = useState('kanji');
    const [config, setConfig] = useState({ text: '' });
    // Bộ nhớ tạm để lưu text của 2 chế độ
    const [textCache, setTextCache] = useState({ kanji: '', vocab: '' });

    // Hàm xử lý chuyển đổi chế độ thông minh
    const handleModeSwitch = (newMode) => {
        if (newMode === practiceMode) return;
        // Lưu dữ liệu của tab hiện tại vào bộ nhớ tạm
        setTextCache(prev => ({ ...prev, [practiceMode]: config.text }));
        // Đổi chế độ
        setPracticeMode(newMode);
        // Lấy dữ liệu của tab mới từ bộ nhớ tạm (nếu có)
        setConfig(prev => ({ ...prev, text: textCache[newMode] || '' }));
    };
    
    const [dbData, setDbData] = useState(null);
    const [isDbLoaded, setIsDbLoaded] = useState(false);
    
    const [srsData, setSrsData] = useState(() => {
        const saved = localStorage.getItem('phadao_srs_data');
        return saved ? JSON.parse(saved) : {};
    });

    const [customVocabData, setCustomVocabData] = useState({}); 
    const [editingVocab, setEditingVocab] = useState(null);

React.useEffect(() => {
        // 1. Chặn chuột phải (Context Menu)
        const handleContextMenu = (e) => {
            e.preventDefault();
        };

        // 2. Chặn các tổ hợp phím tắt
        const handleKeyDown = (e) => {
            // Chặn F12
            if (e.key === 'F12') {
                e.preventDefault();
            }
            // Chặn Ctrl + U (Xem nguồn trang)
            if (e.ctrlKey && e.key.toLowerCase() === 'u') {
                e.preventDefault();
            }
            // Chặn Ctrl + Shift + I / J / C (Các kiểu mở DevTools)
            if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            // Chặn Ctrl + S (Lưu trang web về máy)
            if (e.ctrlKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
            }
            // Chặn Ctrl + P (In trang web)
            if (e.ctrlKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
            }
        };

        // Đăng ký bộ lắng nghe sự kiện
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        // Dọn dẹp khi component unmount
        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
    // --- TẢI DỮ LIỆU KHI VÀO TRANG ---
    useEffect(() => {
        fetchDataFromGithub().then(data => {
            if (data) {
                setDbData(data);
                setIsDbLoaded(true);
            }
        });
    }, []);

   // --- CÁC HÀM XỬ LÝ DỮ LIỆU ---
    const handleSaveVocab = (word, newReading, newMeaning, newHanviet) => {
        setCustomVocabData(prev => ({
            ...prev,
            [word]: { reading: newReading, meaning: newMeaning, hanviet: newHanviet }
        }));

        setDbData(prevDb => {
            if (!prevDb) return prevDb;
            
            // BÍ QUYẾT Ở ĐÂY: Lưu lại con trỏ đến dữ liệu JSON gốc trước khi ghi đè lần đầu tiên
            const originalTuvung = prevDb.ORIGINAL_TUVUNG_DB || prevDb.TUVUNG_DB;

            return {
                ...prevDb,
                ORIGINAL_TUVUNG_DB: originalTuvung, // Giữ lại bản nguyên thủy
                TUVUNG_DB: {
                    ...prevDb.TUVUNG_DB,
                    [word]: {
                        ...(prevDb.TUVUNG_DB?.[word] || {}),
                        reading: newReading,
                        meaning: newMeaning,
                        hanviet: newHanviet
                    }
                }
            };
        });
        
        setEditingVocab(null); 
    };
    const updateSRSProgress = (char, quality) => {
        const newProgress = calculateSRS(srsData[char], quality);
        const newData = { ...srsData, [char]: newProgress };
        setSrsData(newData);
        localStorage.setItem('phadao_srs_data', JSON.stringify(newData));
    };

    const handleResetAllSRS = () => {
        setSrsData({}); 
        localStorage.removeItem('phadao_srs_data'); 
    };

   const handleStartLearning = (target) => {
        // Nếu đang ở màn chia động từ và bấm tiếp tục
        if (setupConfig.targetAction === 'conjugate' && target === 'preview') {
            setSetupConfig(prev => ({ ...prev, isOpen: false }));
            setIsVerbPreviewOpen(true);
            return;
        }
        
        if (target === 'preview') {
            setSetupConfig(prev => ({ ...prev, isOpen: false }));
            setIsPreviewListOpen(true);
        } else {
            setSetupConfig({ isOpen: false, targetAction: null });
            setIsPreviewListOpen(false);
            setIsVerbPreviewOpen(false);
            
            // FIX LỖI: Chuyển đổi thành cấu trúc if - else if để đảm bảo
            // hệ thống CHỈ MỞ 1 BẢNG DUY NHẤT, không bị mở trùng lặp
            if (target === 'flashcard') {
                setIsFlashcardOpen(true);
            } else if (target === 'game') {
                setIsLearnGameOpen(true);
            } else if (target === 'essay') {
                setIsEssayOpen(true);
            } else if (target === 'conjugate') {
                // CHỈ mở game động từ khi target thực sự là 'conjugate'
                if (verbPracticeMode === 'quiz') setIsVerbQuizOpen(true);
                else if (verbPracticeMode === 'reflex') setIsVerbReflexOpen(true);
                else setIsVerbEssayOpen(true);
            } else if (target === 'kaiwa') {    // <--- THÊM MỚI Ở ĐÂY
                setIsKaiwaOpen(true);           // <--- THÊM MỚI Ở ĐÂY
            }
        }
    };
    // --- HIỂN THỊ LOADING ---
    if (!isDbLoaded) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white">
                <div className="w-12 h-12 border-4 border-gray-100 border-t-gray-900 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Đang tải dữ liệu...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-gray-200">
            
{/* 1. TRANG CHỦ TỐI GIẢN (CHỈ CÓ NÚT) */}
<LandingPage 
    srsData={srsData}
    onOpenReviewList={() => setIsReviewListOpen(true)}
    onOpenDictionary={() => setIsDictionaryOpen(true)}
    onOpenDictation={() => setIsDictationMenuOpen(true)}
    onOpenSetup={(target) => {
        // FIX Ở ĐÂY: Nếu là kaiwa thì mở luôn bảng Kaiwa, chặn không cho mở bảng nhập Text
        if (target === 'kaiwa') {
            setIsKaiwaOpen(true);
        } else {
            // Các tính năng khác vẫn mở bảng Setup bình thường
            setSetupConfig({ isOpen: true, targetAction: target });
            // Tự động chuyển sang chế độ Từ vựng nếu là Chia động từ
            if (target === 'conjugate') {
                handleModeSwitch('vocab'); 
            }
        }
    }}
/>

            {/* 2. MODAL NHẬP LIỆU & THIẾT LẬP BÀI HỌC CHUNG */}
            <StudySetupModal 
                isOpen={setupConfig.isOpen}
                onClose={() => setSetupConfig({ isOpen: false, targetAction: null })}
                targetAction={setupConfig.targetAction}
                onStart={handleStartLearning}
                config={config}
                onChange={setConfig}
                mode={practiceMode}
                setPracticeMode={handleModeSwitch}
                dbData={dbData}
                srsData={srsData}
                    verbTargetForm={verbTargetForm}
                setVerbTargetForm={setVerbTargetForm}
                    verbPracticeMode={verbPracticeMode}
    setVerbPracticeMode={setVerbPracticeMode}
    verbSelectedForms={verbSelectedForms}
    setVerbSelectedForms={setVerbSelectedForms}
            />
{/* MODAL: DANH SÁCH XEM TRƯỚC TỪ VỰNG & KANJI */}
            <PreviewListModal
                isOpen={isPreviewListOpen}
                onClose={() => {
                    setIsPreviewListOpen(false);
                   setSetupConfig(prev => ({ ...prev, isOpen: true }));
                }}
                onStart={handleStartLearning}
                targetAction={setupConfig.targetAction}
                text={config.text}
                mode={practiceMode}
                dbData={dbData}
                customVocabData={customVocabData}
                onSaveVocab={handleSaveVocab}
            />
            {/* 3. CÁC MODAL HỌC TẬP / GAME / DANH SÁCH (GIỮ NGUYÊN 100%) */}
            <FlashcardModal 
                isOpen={isFlashcardOpen} 
                onClose={() => setIsFlashcardOpen(false)} 
                text={config.text} 
                dbData={dbData} 
                onSrsUpdate={updateSRSProgress}
                srsData={srsData} 
                mode={practiceMode}
                onSrsRestore={(char, oldData) => {
                    const newData = { ...srsData, [char]: oldData };
                    setSrsData(newData);
                    localStorage.setItem('phadao_srs_data', JSON.stringify(newData));
                }}
            />

            <LearnGameModal 
                isOpen={isLearnGameOpen}
                onClose={() => setIsLearnGameOpen(false)}
                text={config.text}
                dbData={dbData}
                mode={practiceMode}
                onSwitchToFlashcard={() => {
                    setIsLearnGameOpen(false);
                    setIsFlashcardOpen(true); 
                }}
            />

            <EditVocabModal  
                isOpen={!!editingVocab}
                onClose={() => setEditingVocab(null)}
                data={editingVocab}
                onSave={handleSaveVocab}
                dbData={dbData}
            />
    <EssayGameModal 
    isOpen={isEssayOpen}
    onClose={() => setIsEssayOpen(false)}
    text={config.text}
    dbData={dbData}
    mode={practiceMode}
    onSwitchMode={(target) => handleStartLearning(target)} // Quan trọng để chuyển chế độ nhanh
/>
    <VerbPreviewListModal 
                isOpen={isVerbPreviewOpen}
                onClose={() => {
                    setIsVerbPreviewOpen(false);
                    setSetupConfig(prev => ({ ...prev, isOpen: true }));
                }}
                text={config.text}
                dbData={dbData}
                targetForm={verbTargetForm}
                verbPracticeMode={verbPracticeMode}
                onUpdateText={(newText) => {
                    setConfig({ ...config, text: newText });
                    setTextCache(prev => ({ ...prev, vocab: newText }));
                }}
                onStart={(finalData, targetF) => {
                    setIsVerbPreviewOpen(false);
                    setVerbPracticeData(finalData);
                    setVerbTargetForm(targetF);
                    
                    // KIỂM TRA MODE ĐỂ MỞ ĐÚNG GAME (Đoạn này rất quan trọng)
                    if (verbPracticeMode === 'quiz') {
                        setIsVerbQuizOpen(true);
                    } else if (verbPracticeMode === 'reflex') {
                        setIsVerbReflexOpen(true);
                    } else {
                        setIsVerbEssayOpen(true);
                    }
                }}
                globalVerbReadings={globalVerbReadings}
                setGlobalVerbReadings={setGlobalVerbReadings}
            />
            <VerbEssayGameModal
                isOpen={isVerbEssayOpen}
                onClose={() => setIsVerbEssayOpen(false)}
                verbsData={verbPracticeData}
                targetForm={verbTargetForm}
            />
                    <VerbQuizGameModal
    isOpen={isVerbQuizOpen}
    onClose={() => setIsVerbQuizOpen(false)}
    verbsData={verbPracticeData}
    selectedForms={verbSelectedForms}
/>
        <VerbReflexGameModal
                isOpen={isVerbReflexOpen}
                onClose={() => setIsVerbReflexOpen(false)}
                verbsData={verbPracticeData}
                selectedForms={verbSelectedForms}
            />
                    <KaiwaModal 
        isOpen={isKaiwaOpen} 
        onClose={() => setIsKaiwaOpen(false)} 
    />
    <KanjiDictionaryModal 
    isOpen={isDictionaryOpen}
    onClose={() => setIsDictionaryOpen(false)}
    dbData={dbData}
    config={config}
    setConfig={setConfig}
    setPracticeMode={handleModeSwitch}
/>
        
<DictationModal 
        isOpen={isDictationMenuOpen}
        onClose={() => setIsDictationMenuOpen(false)}
    />
            {/* 3. RENDER MODAL DANH SÁCH LỊCH TRÌNH */} 
            <ReviewListModal 
    isOpen={isReviewListOpen}
    onClose={() => setIsReviewListOpen(false)}
    srsData={srsData}
    dbData={dbData}
    onResetSRS={handleResetAllSRS}
    onLoadChars={(chars) => {
        // === FIX LỖI: Tự động lưu cache và chuyển sang chế độ Kanji ===
        if (practiceMode === 'vocab') {
            setTextCache(prev => ({ ...prev, vocab: config.text }));
        }
        setPracticeMode('kanji'); // Ép sang chế độ Kanji
        setConfig({ text: chars }); // Đưa danh sách chữ cần ôn vào
        
        setIsReviewListOpen(false);
        // Tự động mở flashcard ngay lập tức
        setTimeout(() => setIsFlashcardOpen(true), 100);
    }}
/>
        </div>
    );
};
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
