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
    const [dbResponse, tuvungResponse, exceptionResponse] = await Promise.all([
      fetch('./data/kanji_db.json'),
      fetch('./data/tuvungg.json'),
      fetch('./data/dongtu_dacbiet.json')
    ]);

    // 2. Tải thêm 5 file danh sách cấp độ (N5 -> N1)
    const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
    const levelPromises = levels.map(l => fetch(`./data/kanji${l}.json`));
    const levelResponses = await Promise.all(levelPromises);

    let kanjiDb = null;
    let kanjiLevels = {}; 

    // Xử lý DB chính (Kanji)
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
    return { ...kanjiDb, TUVUNG_DB: tuvungDb, KANJI_LEVELS: kanjiLevels, EXCEPTION_VERBS: exceptionDb }; 
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
    const convertToKana = (rawText, isKatakanaTarget) => {
        const hiraMap = {
            'a':'あ','i':'い','u':'う','e':'え','o':'お','ka':'か','ki':'き','ku':'く','ke':'け','ko':'こ','sa':'さ','shi':'し','si':'し','su':'す','se':'せ','so':'そ','ta':'た','chi':'ち','ti':'ち','tsu':'つ','tu':'つ','te':'て','to':'と','na':'な','ni':'に','nu':'ぬ','ne':'ね','no':'の','ha':'は','hi':'ひ','fu':'ふ','hu':'ふ','he':'へ','ho':'ほ','ma':'ま','mi':'み','mu':'む','me':'め','mo':'も','ya':'や','yu':'ゆ','yo':'よ','ra':'ら','ri':'り','ru':'る','re':'れ','ro':'ろ','wa':'わ','wo':'を','nn':'ん','ga':'が','gi':'ぎ','gu':'ぐ','ge':'げ','go':'ご','za':'ざ','ji':'じ','zi':'じ','zu':'ず','ze':'ぜ','zo':'ぞ','da':'だ','di':'ぢ','du':'づ','de':'で','do':'ど','ba':'ば','bi':'び','bu':'ぶ','be':'べ','bo':'ぼ','pa':'ぱ','pi':'ぴ','pu':'ぷ','pe':'ぺ','po':'ぽ','kya':'きゃ','kyu':'きゅ','kyo':'きょ','sha':'しゃ','shu':'しゅ','sho':'しょ','sya':'しゃ','syu':'しゅ','syo':'しょ','cha':'ちゃ','chu':'ちゅ','cho':'ちょ','tya':'ちゃ','tyu':'ちゅ','tyo':'ちょ','nya':'にゃ','nyu':'にゅ','nyo':'にょ','hya':'ひゃ','hyu':'ひゅ','hyo':'ひょ','mya':'みゃ','myu':'みゅ','myo':'みょ','rya':'りゃ','ryu':'りゅ','ryo':'りょ','gya':'ぎゃ','gyu':'ぎゅ','gyo':'ぎょ','ja':'じゃ','ju':'じゅ','jo':'じょ','zya':'じゃ','zyu':'じゅ','zyo':'じょ','bya':'びゃ','byu':'びゅ','byo':'びょ','pya':'ぴゃ','pyu':'ぴゅ','pyo':'ぴょ','fa':'ふぁ','fi':'ふぃ','fe':'ふぇ','fo':'ふぉ','va':'ゔぁ','vi':'ゔぃ','vu':'ゔ','ve':'ゔぇ','vo':'ゔぉ','-':'ー'
        };
        const toKata = (hira) => hira.split('').map(c => { const code = c.charCodeAt(0); return (code >= 12353 && code <= 12435) ? String.fromCharCode(code + 96) : c; }).join('');
        let result = rawText.toLowerCase();
        result = result.replace(/([bcdfghjklmpqrstvwxyz])\1/g, (match, p1) => p1 === 'n' ? match : 'っ' + p1);
        const keys = Object.keys(hiraMap).sort((a, b) => b.length - a.length);
        for (let key of keys) { result = result.split(key).join(hiraMap[key]); }
        result = result.replace(/n(?=[bcdfghjklmprstvwz])/g, 'ん');
        return isKatakanaTarget ? toKata(result) : result;
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
            items = text.split(/[\n;]+/).map(w => w.trim()).filter(w => w && dbData.TUVUNG_DB?.[w]);
        } else {
            items = Array.from(new Set(text.replace(/[\n\s]/g, ''))).filter(c => dbData.KANJI_DB?.[c]);
        }
        
        const shuffled = items.sort(() => Math.random() - 0.5);
        setQueue(shuffled);
        setInitialTotal(shuffled.length);
    };

   

    const checkIsKatakana = (target) => /[\u30A0-\u30FF]/.test(target);

    const handleInputChange = (e) => {
        const val = e.target.value;
        if (mode === 'vocab') {
            const target = queue[currentIndex] || '';
            setUserInput(convertToKana(val, checkIsKatakana(target)));
        } else {
            setUserInput(val.toUpperCase());
        }
    };

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            initLesson();
        } else {
            document.body.style.overflow = 'unset';
            setFinished(false); // Đảm bảo đóng lại là reset pháo hoa
        }
    }, [isOpen, mode]); // Reset khi mode thay đổi hoặc mở lại

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
                 
                 chars = text.split(/[\n;]+/)
                    .map(w => w.trim())
                    .filter(w => w.length > 0 && dbData?.TUVUNG_DB && dbData.TUVUNG_DB[w]);
            } else {
                chars = Array.from(text).filter(c => c.trim()); 
            }
            chars = [...new Set(chars)];
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
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="50" y1="0" x2="50" y2="100" stroke="black" strokeWidth="0.5" strokeDasharray="4 4" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="black" strokeWidth="0.5" strokeDasharray="4 4" />
                </svg>

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
                const readingDisplay = targetInfo.reading && targetInfo.reading !== target ? `(${targetInfo.reading})` : '';
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
    if (gameState === 'loading') return null;

    const visualPercent = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;

    return (
        <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-xl p-4 animate-in fade-in select-none">
            
            {/* --- TRƯỜNG HỢP 1: KẾT THÚC (FINISHED SCREEN) --- */}
            {gameState === 'finished' ? (
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
                            className="flex-1 py-4 bg-gray-900 hover:bg-black text-white font-black rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-widest flex justify-center items-center gap-2"
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

// --- COMPONENT: TRANG CHỦ CHUYÊN NGHIỆP ---
const LandingPage = ({ srsData, onOpenReviewList, onOpenSetup, dbData }) => {
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
            id: 1, 
            title: 'Giao diện web mới', 
            date: '08/03/2026', 
            content: 'Mình đang nâng cấp trang web, sắp tới còn rất nhiều tính năng mới. Các bạn đón chờ nhé!'
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
                            <button onClick={() => setIsDocsModalOpen(true)} className="text-sm font-bold text-zinc-600 hover:text-zinc-900 px-2 py-1 rounded-lg hover:bg-zinc-50">Tài liệu</button>
                            <div className="relative flex items-center" ref={notifRef}>
                                <button onClick={handleToggleNotif} className="relative p-2 text-zinc-500 hover:text-zinc-900 rounded-full hover:bg-zinc-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                                    {hasNewNotif && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>}
                                </button>
                                {isNotifOpen && <NotificationDropdown />}
                            </div>
                            <div className="h-4 w-px bg-zinc-200 mx-2"></div>
                            <a href="https://zalo.me/g/jeflei549" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-zinc-900 text-white rounded-full text-sm font-bold hover:bg-zinc-800 shadow-sm">Tham gia Nhóm</a>
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
                            <div className="absolute top-4 right-4 bg-blue-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md shadow-blue-500/20 animate-pulse">
                                MỚI
                            </div>
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1 text-zinc-900">CHIA ĐỘNG TỪ</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Từ vựng & ngữ pháp</p>
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

                        {/* 6. LUYỆN JLPT */}
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

            {/* FOOTER: THÊM MỤC TÀI LIỆU VÀ NHÓM TRÊN MOBILE */}
            <footer className="bg-white border-t border-zinc-100 py-12 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:flex-row gap-4 md:gap-6">
                        <a href="https://www.tiktok.com/@phadaotiengnhat" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                            <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                            </div>
                            <span className="font-bold tracking-tight text-zinc-900">Tiktok</span>
                        </a>
                        
                        {/* 2 Nút này chỉ hiện trên Mobile (md:hidden) */}
                        <button onClick={() => setIsDocsModalOpen(true)} className="md:hidden text-sm font-bold text-zinc-600 uppercase tracking-widest">Tài liệu</button>
                        <a href="https://zalo.me/g/jeflei549" target="_blank" rel="noopener noreferrer" className="md:hidden text-sm font-bold text-zinc-600 uppercase tracking-widest">Nhóm học tập</a>
                    </div>
                    <p className="text-sm text-zinc-500">© 2026 Phá Đảo Tiếng Nhật.</p>
                </div>
            </footer>

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

                {/* Flashcard từ vựng */}
                <a href="https://quizlet.com/join/nuE9y8xHf?i=4yxqkk&x=1bqt" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-purple-700 pb-1">Flashcard từ vựng N5-N1</p>
                        <p className="text-[10px] text-gray-400">354 học phần</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-purple-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>

                {/* nhóm học tập */}
                <a href="https://zalo.me/g/jeflei549" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group">
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
const SearchBar = ({ mode, dbData, onSelectResult, onSelectAll }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const searchInputRef = useRef(null);
    const scrollRef = useRef(null);

    // Cuộn tự động khi dùng phím mũi tên
    useEffect(() => {
        if (scrollRef.current && searchResults.length > 0) {
            // Offset active index nếu có nút "Thêm tất cả" (mode vocab)
            const indexToScroll = mode === 'vocab' ? activeIndex + 1 : activeIndex;
            const activeItem = scrollRef.current.childNodes[indexToScroll];
            if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [activeIndex, searchResults.length, mode]);

    // Hàm lấy cấp độ JLPT
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

        if (!query || !dbData) {
            setSearchResults([]);
            return;
        }

        let matches = [];

        if (mode === 'vocab') {
            const isInputKanji = query.match(/[\u4E00-\u9FAF]/);
            if (!isInputKanji) { setSearchResults([]); return; }

            if (dbData.TUVUNG_DB) {
                Object.entries(dbData.TUVUNG_DB).forEach(([word, info]) => {
                    // Lấy thêm meaning cho từ vựng
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
                    
                    // Info đã chứa sẵn meaning
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
    }

    return (
        <div className="relative w-full z-20">
            {/* Ô Input Tìm Kiếm */}
            <input 
                ref={searchInputRef}
                type="text" 
                value={searchTerm}
                onChange={(e) => handleSearchRealtime(e.target.value)}
                onKeyDown={(e) => {
                    if (searchResults.length > 0) {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0)); } 
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1)); } 
                        else if (e.key === 'Enter') { e.preventDefault(); handleSelect(searchResults[activeIndex]); }
                    }
                }}
                placeholder={mode === 'vocab' ? "Nhập 1 chữ hán để tìm TỪ VỰNG đi kèm..." : "Nhập âm Hán Việt để tìm KANJI..."} 
                className="w-full pl-10 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-[16px] focus:outline-none focus:ring-2 focus:ring-gray-900 font-bold placeholder-gray-400 transition-all"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path strokeWidth="2" strokeLinecap="round" d="m21 21-4.3-4.3"/></svg>

            {/* Nút Xóa (Dấu X) */}
            {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setSearchResults([]); searchInputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-900 transition-colors bg-transparent rounded-full hover:bg-gray-200">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            )}

            {/* Khung Gợi Ý Kết Quả */}
            {searchResults.length > 0 && (
                <div ref={scrollRef} className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar p-2">
                    
                    {/* Nút thêm tất cả (Từ vựng) */}
                    {mode === 'vocab' && (
                        <button onClick={handleSelectAll} className="w-full mb-2 py-2 bg-gray-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-black active:scale-95 transition-all">
                            Thêm tất cả ({searchResults.length})
                        </button>
                    )}

                    {/* Danh sách thẻ kết quả */}
                    {searchResults.map((item, idx) => {
                        const level = item.type === 'kanji' ? getJLPTLevel(item.char) : null; 

                        return (
                            <div 
                                key={idx} 
                                onClick={() => handleSelect(item)} 
                                className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-xl transition-colors ${idx === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                            >
                                {/* 1. CHỮ KANJI (Bên trái) */}
                                <span className={`font-['Klee_One'] text-gray-900 font-bold flex-shrink-0 ${mode === 'vocab' ? "text-xl" : "text-2xl"}`}>
                                    {item.char}
                                </span>

                                {/* 2. ÂM ĐỌC & Ý NGHĨA (Ở giữa) */}
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

                                {/* 3. TAG JLPT HOẶC BỘ THỦ (Bên phải - MONOCHROME) */}
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
        return "phân cách bằng dấu xuống dòng\n(nhập thể masu và kèm kanji)\nvd: 食べます";
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
<div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
    {targetAction !== 'conjugate' ? (
        <div className="flex bg-gray-200/50 p-1 rounded-xl border border-gray-200">
            <button onClick={() => setPracticeMode('kanji')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'kanji' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}>KANJI</button>
            <button onClick={() => setPracticeMode('vocab')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'vocab' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}>TỪ VỰNG</button>
        </div>
    ) : (
       /* GIAO DIỆN MỚI CHO CHIA ĐỘNG TỪ TẠI ĐÂY */
        <div className="flex bg-gray-200/50 p-1 rounded-xl border border-gray-200">
            <button onClick={() => setVerbPracticeMode('essay')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${verbPracticeMode === 'essay' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}>TỰ LUẬN</button>
            <button onClick={() => setVerbPracticeMode('quiz')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${verbPracticeMode === 'quiz' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}>TRẮC NGHIỆM</button>
        </div>
    )}
    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm">✕</button>
</div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-5 relative">
                    {/* Thêm phần chọn Thể nếu đang là chế độ Conjugate */}
{/* Thêm phần chọn Thể với UI Dropdown Custom */}
{targetAction === 'conjugate' && (
    <div className="mb-6 relative z-[60]" ref={formDropdownRef}>
        
        {/* NẾU LÀ TỰ LUẬN: BẢNG CHỌN DROPDOWN CŨ */}
        {verbPracticeMode === 'essay' && (
            <>
                <button 
                    onClick={() => setIsFormDropdownOpen(!isFormDropdownOpen)}
                    className="w-full p-4 bg-white border-2 border-indigo-100 hover:border-indigo-300 rounded-2xl font-bold text-gray-900 flex justify-between items-center transition-all shadow-sm group"
                >
                    <span className="text-indigo-700 flex items-center gap-2">
                        <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        {[
                            { id: "Te", label: "Thể Te (て)" }, { id: "Ta", label: "Thể Ta (た)" }, { id: "Nai", label: "Thể Nai (ない)" },
                            { id: "Dictionary", label: "Thể Từ Điển (る)" }, { id: "Ba", label: "Thể Điều Kiện (ば)" }, { id: "Volitional", label: "Thể Ý Chí (よう)" },
                            { id: "Imperative", label: "Thể Mệnh Lệnh (ろ/え)" }, { id: "Prohibitive", label: "Thể Cấm Chỉ (な)" }, { id: "Potential", label: "Thể Khả Năng (える/られる)" },
                            { id: "Passive", label: "Thể Bị Động (れる/られる)" }, { id: "Causative", label: "Thể Sai Khiến (せる/させる)" }, 
                            { id: "CausativePassive", label: "Bị Động Sai Khiến (させられる)" }
                        ].find(opt => opt.id === verbTargetForm)?.label || 'Chọn thể...'}
                    </span>
                    <svg className={`w-5 h-5 text-indigo-400 group-hover:text-indigo-600 transition-transform duration-300 ${isFormDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {isFormDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-[0_10px_40px_rgb(0,0,0,0.1)] max-h-56 overflow-y-auto custom-scrollbar p-2 animate-in fade-in zoom-in-95 duration-200">
                        {[
                            { id: "Te", label: "Thể Te (て)" }, { id: "Ta", label: "Thể Ta (た)" }, { id: "Nai", label: "Thể Nai (ない)" },
                            { id: "Dictionary", label: "Thể Từ Điển (る)" }, { id: "Ba", label: "Thể Điều Kiện (ば)" }, { id: "Volitional", label: "Thể Ý Chí (よう)" },
                            { id: "Imperative", label: "Thể Mệnh Lệnh (ろ/え)" }, { id: "Prohibitive", label: "Thể Cấm Chỉ (な)" }, { id: "Potential", label: "Thể Khả Năng (える/られる)" },
                            { id: "Passive", label: "Thể Bị Động (れる/られる)" }, { id: "Causative", label: "Thể Sai Khiến (せる/させる)" }, 
                            { id: "CausativePassive", label: "Bị Động Sai Khiến (させられる)" }
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

      {/* NẾU LÀ TRẮC NGHIỆM: MULTI-SELECT CHỌN NHIỀU THỂ */}
        {verbPracticeMode === 'quiz' && (
            <div className="relative">
                {/* Nút bấm để mở Dropdown */}
                <button 
                    onClick={() => setIsFormDropdownOpen(!isFormDropdownOpen)}
                    className="w-full p-4 bg-white border-2 border-indigo-100 hover:border-indigo-300 rounded-2xl flex justify-between items-center transition-all shadow-sm group"
                >
                    <div className="flex flex-col items-start text-left">
                        <span className="text-indigo-700 font-bold flex items-center gap-2">
                            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                            {verbSelectedForms.length === 0 
                                ? "Chọn thể động từ..." 
                                : `Đã chọn ${verbSelectedForms.length} thể động từ`}
                        </span>
                        
                        {/* CHỈ HIỆN CHÚ Ý KHI ĐANG MỞ BẢNG VÀ CHƯA CHỌN ĐỦ */}
                        {isFormDropdownOpen && verbSelectedForms.length < 4 && (
                            <span className="text-[10px] mt-1.5 text-red-500 font-bold">
                                * Chú ý: Cần chọn tối thiểu 4 thể
                            </span>
                        )}
                    </div>

                    <svg className={`w-5 h-5 text-indigo-400 transition-transform duration-300 flex-shrink-0 ${isFormDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {/* Khung Dropdown Danh sách 12 Thể */}
                {isFormDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] p-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                        
                        {/* Grid 3 cột */}
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
                                            if (isSelected) {
                                                setVerbSelectedForms(prev => prev.filter(f => f !== opt.id));
                                            } else {
                                                setVerbSelectedForms(prev => [...prev, opt.id]);
                                            }
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
    //  XỬ LÝ LỌC KANA CHO TỰ LUẬN KANJI
    // ==========================================
 // KIỂM TRA ĐIỀU KIỆN TRẮC NGHIỆM ĐỘNG TỪ
    if (targetAction === 'conjugate' && verbPracticeMode === 'quiz') {
        if (verbSelectedForms.length < 4) {
            alert("Vui lòng chọn ít nhất 4 thể động từ để làm bài trắc nghiệm!");
            return;
        }
    }
    if (mode === 'kanji' && targetAction === 'essay') {
        // Regex nhận diện Hiragana và Katakana
        const kanaRegex = /[\u3040-\u309F\u30A0-\u30FF]/g;
        const hasKana = kanaRegex.test(cleanLatinh);
        const onlyKanji = cleanLatinh.replace(kanaRegex, ''); // Xóa hết Kana, chỉ giữ Kanji

        if (hasKana) {
            if (onlyKanji.trim().length === 0) {
                // Nếu xóa Kana xong mà chuỗi rỗng => Tức là người dùng CHỈ nhập Kana
                alert("Chế độ Tự Luận không hỗ trợ kiểm tra Bảng chữ cái.\nVui lòng nhập Kanji!");
                return; // Chặn không cho đi tiếp
            } else {
                // Nếu nhập lẫn lộn => Tự động bỏ qua Kana, giữ lại Kanji
                cleanLatinh = onlyKanji;
            }
        }
    }
    // ==========================================

    setLocalText(cleanLatinh); 
    onChange({ ...config, text: cleanLatinh });

    if (!cleanLatinh || cleanLatinh.trim().length === 0) return alert("Bạn chưa nhập dữ liệu để học!");
    
    // ĐÓNG TẠM BẢNG SETUP, BÁO LÊN APP ĐỂ MỞ PREVIEW LIST
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
                        
                        // CHỈ CHIA THỂ KHI KHÔNG PHẢI LÀ TRẮC NGHIỆM
                        let conjugatedResult = "...";
                        if (currentReading && verbPracticeMode !== 'quiz') {
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
                                        /* ĐÃ ẨN ĐI NẾU LÀ TRẮC NGHIỆM */
                                        verbPracticeMode !== 'quiz' && (
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
                        {verbPracticeMode === 'quiz' ? 'VÀO TRẮC NGHIỆM' : 'VÀO TỰ LUẬN'}
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
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            initLesson();
        } else {
            document.body.style.overflow = 'unset';
            setFinished(false);
        }
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

        // Lấy đáp án đúng từ Engine (Có thể chứa " / " nếu có 2 cách chia)
        const targetConjugation = VerbEngine.conjugate(currentItem.finalReading, currentItem, targetForm);
        
        // Tách ra thành mảng nếu có nhiều đáp án (VD: Nhóm 1 Bị động sai khiến)
        let baseAnswers = targetConjugation.split(" / ");
        let acceptableAnswers = [...baseAnswers];

        // Cho phép nhập thêm đuôi ~ます với các thể kết thúc bằng る
        if (["Potential", "Passive", "Causative", "CausativePassive"].includes(targetForm)) {
            // Duyệt qua từng đáp án ngắn, bỏ る thêm ます
            const politeForms = baseAnswers.map(ans => ans.slice(0, -1) + 'ます');
            acceptableAnswers = [...acceptableAnswers, ...politeForms];
        }

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
            
            const displayAnswer = baseAnswers.length > 1 
                ? `${baseAnswers[0]} / ${baseAnswers[1]}` 
                : baseAnswers[0];
                
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

                    <div className={`flex flex-col items-center text-center mb-10 transition-all duration-300 ${status === 'correct' ? 'scale-110 opacity-50' : status === 'wrong' ? 'animate-shake' : ''}`}>
                        <h2 className="text-5xl font-bold font-sans text-zinc-800 mb-3">{currentItem.vmasu}</h2>
                        {/* ĐÃ XÓA Ý NGHĨA Ở ĐÂY NHƯ YÊU CẦU */}
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

    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            initLesson();
        } else {
            document.body.style.overflow = 'unset';
            setFinished(false);
        }
    }, [isOpen, initLesson]);

    const triggerConfetti = React.useCallback(() => {
        if (typeof confetti === 'undefined') return;
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 2000 });
    }, []);

    React.useEffect(() => { if (finished && isOpen) triggerConfetti(); }, [finished, isOpen, triggerConfetti]);

    const checkAnswer = (optId) => {
        if (status !== 'idle') return;
        
        const currentItem = queue[currentIndex];
        setSelectedOpt(optId);

        // Tự động chia thử động từ theo cái nút mà người dùng vừa bấm
        const chosenConjKanji = VerbEngine.conjugate(currentItem.vmasu, currentItem, optId).split(" / ")[0];

        // Nếu kết quả chia ra GIỐNG HỆT chữ đang hiện trên màn hình => CHÍNH XÁC!
        const isCorrect = chosenConjKanji === currentItem.conjKanji;

        if (isCorrect) {
            setStatus('correct');
            if (!wrongDetected) setCorrectFirstTimeCount(prev => prev + 1);
            setTimeout(() => goToNext(), 600);
        } else {
            setStatus('wrong');
            setWrongDetected(true);
            setQueue(prev => [...prev, currentItem]);
            setTimeout(() => {
                setStatus('idle');
                setSelectedOpt(null);
                setWrongDetected(false); 
            }, 1500); 
        }
    };

    const goToNext = () => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setStatus('idle');
            setSelectedOpt(null);
            setWrongDetected(false);
        } else {
            setFinished(true);
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
                        <h2 className="text-6xl font-['Klee_One'] text-zinc-800 mb-2 leading-tight">
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
                                // Kiểm tra xem nút này có sinh ra kết quả đúng không (để tô xanh)
                                const optConjKanji = VerbEngine.conjugate(currentItem.vmasu, currentItem, optId).split(" / ")[0];
                                const isThisOptCorrect = optConjKanji === currentItem.conjKanji;

                                if (isThisOptCorrect) {
                                    btnStyle = "bg-green-500 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"; 
                                } else if (optId === selectedOpt && status === 'wrong') {
                                    btnStyle = "bg-red-500 border-red-500 text-white animate-shake"; 
                                } else {
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
    const [verbPracticeData, setVerbPracticeData] = useState([]);
    const [verbTargetForm, setVerbTargetForm] = useState('Te');
    const [globalVerbReadings, setGlobalVerbReadings] = useState({});
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
            
            if (target === 'flashcard') setIsFlashcardOpen(true);
            if (target === 'game') setIsLearnGameOpen(true);
            if (target === 'essay') setIsEssayOpen(true);
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
    onOpenSetup={(target) => {
        setSetupConfig({ isOpen: true, targetAction: target });
        // Tự động chuyển sang chế độ Từ vựng nếu là Chia động từ
        if (target === 'conjugate') {
            handleModeSwitch('vocab'); 
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
    verbPracticeMode={verbPracticeMode} // <-- Truyền mode xuống
    
    onUpdateText={(newText) => {
        setConfig({ ...config, text: newText });
        setTextCache(prev => ({ ...prev, vocab: newText }));
    }}

    onStart={(finalData, targetF) => {
        setIsVerbPreviewOpen(false);
        setVerbPracticeData(finalData);
        setVerbTargetForm(targetF);
        
        // KIỂM TRA MODE ĐỂ MỞ ĐÚNG GAME
        if (verbPracticeMode === 'quiz') {
            setIsVerbQuizOpen(true);
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
