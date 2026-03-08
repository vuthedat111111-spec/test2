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

// --- FETCH DATA FROM GITHUB (ĐÃ SỬA: TẢI THÊM N5-N1) --- 
const fetchDataFromGithub = async () => {
  try { 
    // 1. Tải các file cơ sở dữ liệu chính (THÊM tuvungg.json)
    const [dbResponse, onkunResponse, vocabResponse, tuvungResponse] = await Promise.all([
      fetch('./data/kanji_db.json'),
      fetch('./data/onkun.json'),
      fetch('./data/vocab.json'),
      fetch('./data/tuvungg.json')
    ]);

    // 2. Tải thêm 5 file danh sách cấp độ (N5 -> N1)
    const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
    const levelPromises = levels.map(l => fetch(`./data/kanji${l}.json`));
    const levelResponses = await Promise.all(levelPromises);

    let kanjiDb = null;
    let onkunDb = null;
    let vocabDb = null;
    let kanjiLevels = {}; 

    // Xử lý DB chính
    if (dbResponse.ok) kanjiDb = await dbResponse.json();
    if (onkunResponse.ok) onkunDb = await onkunResponse.json();
    if (vocabResponse.ok) vocabDb = await vocabResponse.json();

    // Xử lý file Từ vựng (MỚI)
    let tuvungDb = {};
    if (tuvungResponse && tuvungResponse.ok) {
        tuvungDb = await tuvungResponse.json();
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

    // Trả về dữ liệu gộp (THÊM TUVUNG_DB)
    return { ...kanjiDb, ONKUN_DB: onkunDb, VOCAB_DB: vocabDb, TUVUNG_DB: tuvungDb, KANJI_LEVELS: kanjiLevels }; 
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

const useKanjiReadings = (char, active, dbData) => {
  const [readings, setReadings] = useState({ on: '', kun: '' });

  useEffect(() => {
    if (!char || !active) return;

    
    if (dbData?.ONKUN_DB && dbData.ONKUN_DB[char]) {
      const info = dbData.ONKUN_DB[char];
      setReadings({
        
        on: info.readings_on?.join(', ') || '---', 
        kun: info.readings_kun?.join(', ') || '---'
      });
      return; 
    }

 
    fetch(`https://kanjiapi.dev/v1/kanji/${char}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setReadings({
            on: data.on_readings?.join(', ') || '---',
            kun: data.kun_readings?.join(', ') || '---'
          });
        }
      })
      .catch(() => setReadings({ on: '---', kun: '---' }));
      
  }, [char, active, dbData]); 

  return readings;
};

const ReviewListModal = ({ isOpen, onClose, srsData, onResetSRS, onLoadChars, dbData }) => {
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const [isHelpOpen, setIsHelpOpen] = React.useState(false);
// --- LOGIC MỚI: TÍNH TIẾN ĐỘ THEO CẤP ĐỘ ---
    const levelProgress = React.useMemo(() => {
        if (!dbData || !dbData.KANJI_LEVELS) return [];
        const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
        const result = [];
        
        levels.forEach(lvl => {
            const totalChars = dbData.KANJI_LEVELS[lvl] || [];
            const totalCount = totalChars.length;
            if (totalCount === 0) return;

            // Đếm số chữ đã có trong srsData (đã học/đang học)
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

    const levelColors = {
        N5: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500' },
        N4: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', bar: 'bg-sky-500' },
        N3: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', bar: 'bg-orange-500' },
        N2: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', bar: 'bg-purple-500' },
        N1: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', bar: 'bg-rose-500' }
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
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 cursor-pointer" onClick={onClose}>
            <div className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200 overflow-hidden relative transition-all cursor-default ${isConfirmOpen ? 'max-w-[300px]' : 'max-w-md'}`} onClick={e => e.stopPropagation()}>
                
                {isHelpOpen ? (
                    // === GIAO DIỆN HƯỚNG DẪN (SRS GUIDE) - NỘI DUNG MỚI ===
                    
                    <>
                         <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
                            <h3 className="text-base font-black text-indigo-700 uppercase flex items-center gap-2">
                                🎓 HƯỚNG DẪN
                            </h3>
                            <button onClick={() => setIsHelpOpen(false)} className="text-indigo-400 hover:text-indigo-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar text-sm text-gray-600 space-y-6 flex-1">
                            
                            {/* 1. Phương pháp học */}
                            <div>
                                <h4 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                                    <span className="text-lg">🧠</span> 1. PHƯƠNG PHÁP HỌC
                                </h4>
                                <p className="text-sm leading-relaxed text-justify">
                                    Hệ thống sử dụng thuật toán <b>Lặp lại ngắt quãng</b> (Spaced Repetition) tích hợp vào <b>FLASHCARD</b>. Thay vì học nhồi nhét, hệ thống sẽ tính toán <b>"thời điểm lãng quên"</b> của não bộ để nhắc bạn ôn lại <b>đúng lúc bạn sắp quên</b>.
                                </p>
                            </div>

                            {/* 2. Cơ chế hoạt động */}
                            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-sm">
    <h4 className="font-bold text-indigo-700 mb-1 flex items-center gap-2">
        <span className="text-lg">⚙️</span> 2. CƠ CHẾ HOẠT ĐỘNG
    </h4>
    <div className="text-indigo-900 leading-relaxed">
        <p className="mb-2">
            Hệ thống tự động tính toán <b>mức độ ghi nhớ</b> của bạn đối với từng Kanji (dựa trên quá trình và kết quả học Flashcard). Từ đó đưa ra <b>lịch trình ôn tập phù hợp</b> riêng cho từng chữ.
        </p>
        <p className="flex gap-1 items-start mt-2 font-medium">
            <span>🔔</span>
            <span><b>Nhắc nhở:</b> Thông báo sẽ tự động xuất hiện trên giao diện web khi đến hạn ôn tập (vào lúc 5 giờ sáng).</span>
        </p>
    </div>
</div>
                            
                            {/* 3. Lưu ý dữ liệu */}
                            <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-sm">
                                <h4 className="font-bold text-yellow-700 mb-1 flex items-center gap-1">
                                    ⚠️ 3. LƯU Ý QUAN TRỌNG VỀ DỮ LIỆU
                                </h4>
                                <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                                    <li><b>Lưu trữ:</b> Dữ liệu học tập được lưu trực tiếp trên <b>Trình duyệt</b> của thiết bị bạn đang dùng.</li>
                                    <li><b>Dung lượng:</b> Cực kỳ nhẹ! Toàn bộ 2136 Kanji chỉ chiếm khoảng 300KB (nhẹ hơn 1 bức ảnh mờ), hoàn toàn không gây nặng máy.</li>
                                    <li><b>Cảnh báo:</b> Dữ liệu sẽ mất nếu bạn <b>Xóa lịch sử duyệt web</b> hoặc dùng <b>Tab ẩn danh</b>. Hãy dùng trình duyệt thường để học nhé!</li>
                                </ul>
                            </div>
                                
{/* --- MỤC 4: SAO LƯU & KHÔI PHỤC (MỚI) --- */}
<div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-sm">
    <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
        <span className="text-lg">💾</span> 4. SAO LƯU & KHÔI PHỤC
    </h4>
    
    <div className="text-emerald-900 leading-relaxed mb-3 text-justify">
        <p className="mb-1">
            <b>Tại sao cần sao lưu?</b> Để chuyển dữ liệu học tập sang máy khác (điện thoại/máy tính), hoặc phòng trường hợp lỡ tay xóa mất lịch sử duyệt web.
        </p>
    </div>

    {/* Cụm nút bấm */}
    <div className="grid grid-cols-2 gap-3">
        {/* NÚT TẢI VỀ */}
        <button 
            onClick={handleExport}
            className="flex flex-col items-center justify-center gap-1 py-2 bg-white border border-emerald-200 text-emerald-700 font-bold rounded-lg shadow-sm hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
        >
            <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>TẢI FILE VỀ</span>
            </div>
            <span className="text-[9px] font-normal opacity-80">(Lưu file .json)</span>
        </button>

        {/* NÚT TẢI LÊN */}
        <label className="flex flex-col items-center justify-center gap-1 py-2 bg-emerald-600 border border-emerald-600 text-white font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition-all active:scale-95 cursor-pointer">
            <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>KHÔI PHỤC</span>
            </div>
            <span className="text-[9px] font-normal opacity-80">(Chọn file đã lưu)</span>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
        </label>
    </div>
</div>
                            <button onClick={() => setIsHelpOpen(false)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-xs uppercase">
                                quay lại lịch trình ôn tập
                            </button>
                        </div>
                    </>

                ) : !isConfirmOpen ? (
                    // === GIAO DIỆN 1: DANH SÁCH (Mặc định) ===
                    <>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-baseline gap-3">
                                <h3 className="text-sm font-bold text-gray-800 uppercase flex items-center gap-2">📅 LỊCH TRÌNH ÔN TẬP</h3>
                                <button onClick={() => setIsHelpOpen(true)} className="text-[12px] font-bold text-blue-500 hover:text-blue-700 underline decoration-blue-300 hover:decoration-blue-700 underline-offset-2 transition-all">
                                    xem hướng dẫn
                                </button>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                            <div className="space-y-4">
                 {/* --- HIỂN THỊ TIẾN ĐỘ (ĐÃ SỬA CO DÃN) --- */}
                {levelProgress.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4">
                        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                            Tiến độ học tập
                        </h4>
                        
                        {/* 1. SỬA CONTAINER: Dùng Flexbox để co dãn */}
                        <div className="flex flex-wrap gap-2">
                            {levelProgress.map((item) => {
                                const style = levelColors[item.level] || levelColors.N5;
                                return (
                                    <div 
                                        key={item.level} 
                                        // 2. SỬA ITEM: Thêm flex-1 và min-w-[40%]
                                        className={`${style.bg} border ${style.border} rounded-lg p-2.5 flex flex-col justify-center flex-1 min-w-[40%]`}
                                    >
                                        <div className="flex justify-between items-end mb-1.5">
                                            <span className={`text-xs font-black ${style.text}`}>{item.level}</span>
                                            <span className={`text-[10px] font-bold ${style.text} opacity-80`}>
                                                {item.learned}/{item.total}
                                            </span>
                                        </div>
                                        {/* Thanh Progress */}
                                        <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${style.bar} transition-all duration-500`} 
                                                style={{ width: `${item.percent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                                <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                                    <div className="flex items-center justify-between mb-2">
                                       <span className="text-sm font-black text-orange-600 uppercase">Cần ôn ngay</span>
<div className="flex items-center gap-2">
    {/* --- NÚT DẤU CỘNG (MỚI) --- */}
    {groupedData.today.length > 0 && (
        <button 
            onClick={(e) => {
                e.stopPropagation();
                onLoadChars(groupedData.today.join(''));
            }}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-orange-200 text-orange-500 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all active:scale-90 shadow-sm"
            title="Tạo bài luyện cho các chữ này"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
    )}
    <span className="bg-orange-200 text-orange-700 text-sm font-bold px-1.5 rounded">{groupedData.today.length} chữ</span>
</div>
                                    </div>
                                    {groupedData.today.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {groupedData.today.map((char, i) => (
                                                <span key={i} className="inline-block bg-white text-gray-800 border border-orange-200 rounded px-1.5 py-0.5 text-lg font-['Klee_One'] min-w-[32px] text-center shadow-sm">{char}</span>
                                            ))}
                                        </div>
                                    ) : (<p className="text-[12px] text-gray-400 italic">Không có Kanji cần ôn. Giỏi quá! 🎉</p>)}
                                </div>

                                {futureDates.length > 0 && (
                                    <div className="space-y-3">
                                         <div className="flex items-center gap-2 mt-2">
                                            <span className="h-[1px] flex-1 bg-gray-100"></span>
                                            <span className="text-sm font-bold text-gray-400 uppercase">Sắp tới</span>
                                            <span className="h-[1px] flex-1 bg-gray-100"></span>
                                        </div>
                                        {futureDates.map(date => (
                                            <div key={date} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
    Ngày {date}
</span>
<div className="flex items-center gap-2">
    {/* --- NÚT DẤU CỘNG (MỚI) --- */}
    <button 
        onClick={(e) => {
            e.stopPropagation();
            onLoadChars(groupedData[date].join(''));
        }}
        className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 transition-all active:scale-90 shadow-sm"
        title="Tạo bài luyện cho ngày này"
    >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
    <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 rounded">{groupedData[date].length} chữ</span>
</div>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {groupedData[date].map((char, i) => (
                                                        <span key={i} className="inline-block bg-white text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 text-base font-['Klee_One'] min-w-[28px] text-center opacity-70">{char}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t border-dashed border-gray-200 text-center pb-2">
                                <button 
                                    onClick={() => {
                                        if (!srsData || Object.keys(srsData).length === 0) {
                                            alert("Danh sách trống");
                                            return;
                                        }
                                        setIsConfirmOpen(true);
                                    }}
                                    className="text-red-700 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 mx-auto"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                    XÓA TOÀN BỘ TIẾN ĐỘ
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    // === GIAO DIỆN 2: CẢNH BÁO XÓA ===
                    <div 
                        className="p-7 text-center animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center justify-center min-h-[300px] cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation(); 
                            setIsConfirmOpen(false); 
                        }}
                    >
                        <div 
                            className="w-full h-full flex flex-col items-center justify-center cursor-default" 
                            onClick={(e) => e.stopPropagation()} 
                        >
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-5 animate-bounce">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            </div>
                            <h3 className="text-xl font-black text-gray-800 mb-2 uppercase">Cảnh báo</h3>
                            <p className="text-sm text-gray-500 mb-8 leading-relaxed max-w-[260px]">
                                Lịch sử học tập sẽ bị xóa vĩnh viễn.<br/>
                                <span className="text-red-500 font-bold">Không thể khôi phục lại!</span>
                            </p>
                            
                            <div className="flex flex-col gap-3 w-full max-w-[260px]">
                                <button onClick={() => setIsConfirmOpen(false)} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 uppercase text-xs tracking-wider">KHÔNG XÓA NỮA</button>
                                <button onClick={() => { onResetSRS(); setIsConfirmOpen(false); onClose(); }} className="w-full py-3 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 font-bold rounded-xl transition-all text-xs">Vẫn xóa dữ liệu</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
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
        
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
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
// 5. Sidebar (Phiên bản: Final)
   const Sidebar = ({ config, onChange, onPrint, srsData, isMenuOpen, setIsMenuOpen, isConfigOpen, setIsConfigOpen, isCafeModalOpen, setIsCafeModalOpen, showMobilePreview, setShowMobilePreview, dbData, setIsFlashcardOpen, onOpenReviewList, setIsLearnGameOpen, mode, setPracticeMode }) => {
   

// 1. Logic bộ lọc mới
const dueChars = useMemo(() => {
    const now = Date.now();
    return Object.keys(srsData || {}).filter(char => {
        const data = srsData[char];
        // Điều kiện: Chưa hoàn thành VÀ (Là chữ đang học HOẶC Đã đến giờ ôn)
        return !data.isDone && data.nextReview !== null && (data.nextReview === 0 || data.nextReview <= now);
    });
}, [srsData]);

// 2. Hàm Load bài mới (Load xong mở ngay)
const handleLoadDueCards = () => {
    if (dueChars.length === 0) return;
    const dueText = dueChars.join('');
    onChange({ ...config, text: dueText }); 
    setTimeout(() => { setIsFlashcardOpen(true); }, 50); 
};
        
        const scrollRef = useRef(null);
    const [searchResults, setSearchResults] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0); 
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
    
    // --- CHẶN TUYỆT ĐỐI CTRL + P (KHÔNG CÓ GÌ XẢY RA) ---
    useEffect(() => {
    const handleKeyDown = (e) => {
        // Kiểm tra Ctrl + P (Win) hoặc Command + P (Mac)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault(); // Chặn trình duyệt mở bảng in
        e.stopPropagation(); // Chặn sự kiện lan truyền
        return false; // Kết thúc ngay lập tức, không làm gì cả
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    
// --- CHẶN CUỘN TRANG KHI MỞ MODAL ---
useEffect(() => {
    // Logic: Nếu khung In HOẶC khung Tài liệu HOẶC Menu Chọn Nhanh (ở chế độ Từ vựng) đang mở
    if (isPrintModalOpen || isDocsModalOpen || (isMenuOpen && mode === 'vocab')) {
        document.body.style.overflow = 'hidden'; // -> KHÓA CUỘN NỀN
    } else {
        document.body.style.overflow = 'unset';  // -> Mở lại bình thường
    }
    
    // Dọn dẹp khi tắt component
    return () => { document.body.style.overflow = 'unset'; };
}, [isPrintModalOpen, isDocsModalOpen, isMenuOpen, mode]); 


    useEffect(() => {
if (scrollRef.current) {
    const activeItem = scrollRef.current.childNodes[activeIndex];
    if (activeItem) {
        // Tự động cuộn đến mục đang chọn (block: 'nearest' để mượt hơn)
        activeItem.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}
}, [activeIndex]); // Chạy lại mỗi khi activeIndex thay đổi

    // --- STATE QUẢN LÝ ---
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
       const [minnaLesson, setMinnaLesson] = useState(1);
    const [mimiN3, setMimiN3] = useState('');          
    const [mimiN2, setMimiN2] = useState('');
    const [mimiN1, setMimiN1] = useState('');
const [tangoN3, setTangoN3] = useState('');
    const [tangoN2, setTangoN2] = useState('');
    const [tangoN1, setTangoN1] = useState('');
    // --- HÀM KIỂM TRA CẤP ĐỘ JLPT ---
const getJLPTLevel = (char) => {
if (dbData.KANJI_LEVELS.N5.includes(char)) return 'N5';
if (dbData.KANJI_LEVELS.N4.includes(char)) return 'N4';
if (dbData.KANJI_LEVELS.N3.includes(char)) return 'N3';
if (dbData.KANJI_LEVELS.N2.includes(char)) return 'N2';
if (dbData.KANJI_LEVELS.N1.includes(char)) return 'N1';
return null;
};

const levelColors = {
N5: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-600 hover:text-white hover:border-green-600',
N4: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600',
N3: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-600 hover:text-white hover:border-orange-600',
N2: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-600 hover:text-white hover:border-purple-600',
N1: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600'
};

    
    // Menu Popup & Ref
    const [isUtilsOpen, setIsUtilsOpen] = useState(false);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterRef = useRef(null);
    const quickMenuRef = useRef(null); // THÊM: Ref cho menu Chọn nhanh
    const utilsMenuRef = useRef(null); // THÊM: Ref cho menu Tiện ích
    const cafeModalRef = useRef(null);
    const searchInputRef = useRef(null); // Tạo "địa chỉ" cho ô nhập liệu
    const configMenuRef = useRef(null);
    // Biến kiểm soát bộ gõ IME (Quan trọng)
    const isComposing = useRef(false);

    const [randomCount, setRandomCount] = useState(10); 

    // State hiển thị nội bộ
    const [localText, setLocalText] = useState(config.text);

    // Tùy chọn bộ lọc
    const [filterOptions, setFilterOptions] = useState({
        hiragana: true,
        katakana: true,
        kanji: true,
        removeDuplicates: false 
    });

   

    // --- 1. CLICK RA NGOÀI ĐỂ ĐÓNG MENU ---
    // --- XỬ LÝ CLICK RA NGOÀI ĐỂ ĐÓNG MENU ---
useEffect(() => {
function handleClickOutside(event) {
    // 1. Xử lý Bộ lọc (Filter)
    if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterMenuOpen(false);
    }

    // 2. Xử lý "Chọn nhanh" (Quick Select) - Tự đóng khi click ra ngoài
    if (isMenuOpen && quickMenuRef.current && !quickMenuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
    }

    // 3. Xử lý "Tiện ích" (Utils) - Tự đóng khi click ra ngoài
    if (isUtilsOpen && utilsMenuRef.current && !utilsMenuRef.current.contains(event.target)) {
        setIsUtilsOpen(false);
    }
    if (isCafeModalOpen && cafeModalRef.current && !cafeModalRef.current.contains(event.target)) {
        setIsCafeModalOpen(false);
    }
    // 5. MỚI: Xử lý "Tùy chỉnh" - Tự đóng khi click ra ngoài
    if (isConfigOpen && configMenuRef.current && !configMenuRef.current.contains(event.target)) {
        setIsConfigOpen(false);
    }

}

document.addEventListener("mousedown", handleClickOutside);
return () => document.removeEventListener("mousedown", handleClickOutside);
}, [isMenuOpen, isUtilsOpen, isFilterMenuOpen, isCafeModalOpen, isConfigOpen]); // Thêm dependencies để cập nhật trạng thái mới nhất

    // --- 2. ĐỒNG BỘ DỮ LIỆU TỪ NGOÀI ---
    useEffect(() => {
        const currentClean = localText ? localText.replace(/[a-zA-Z]/g, '') : '';
        if (currentClean !== config.text) {
            setLocalText(config.text);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.text]);

    const handleChange = (key, value) => {
        onChange({ ...config, [key]: value });
    };

    const shuffleString = (str) => {
        const arr = [...str];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('');
    };

    // --- HÀM TRỢ GIÚP: REGEX ---
    const getAllowedRegexString = (options, allowLatin = false) => {
        let ranges = "\\s;"; 
        if (allowLatin) ranges += "a-zA-Z"; // Latinh luôn được phép ở input

        if (options.hiragana) ranges += "\\u3040-\\u309F";
        if (options.katakana) ranges += "\\u30A0-\\u30FF";
        if (options.kanji)    ranges += "\\u4E00-\\u9FAF\\u3400-\\u4DBF\\u2E80-\\u2FDF\\uF900-\\uFAFF\\u3005"; 
        return ranges;
    };
    // --- HÀM TRỢ GIÚP: XÓA TRÙNG LẶP ---
        const getUniqueChars = (str) => {
            return Array.from(new Set(str)).join('');
            };

    // --- 3. XỬ LÝ CHECKBOX ---
    const handleFilterChange = (key) => {
        const newOptions = { ...filterOptions, [key]: !filterOptions[key] };
        setFilterOptions(newOptions);
        
        let newText = localText;

        // Xử lý các ô Hiragana/Katakana/Kanji (như cũ)
        if (['hiragana', 'katakana', 'kanji'].includes(key) && filterOptions[key] === true) {
            const allowedString = getAllowedRegexString(newOptions, true); 
            const regex = new RegExp(`[^${allowedString}]`, 'g');
            newText = newText.replace(regex, '');
        }

        // Xử lý ô Xóa trùng lặp (MỚI)
        if (newOptions.removeDuplicates) {
            newText = getUniqueChars(newText);
        }
        
        setLocalText(newText);
        handleChange('text', newText.replace(/[a-zA-Z]/g, ''));
    };

// --- 4. NÚT XÓA LATINH + DỒN DÒNG (PHIÊN BẢN XÓA SẠCH SÀNH SANH) ---
    const handleRemoveLatinManual = () => {
        if (!localText) return;
        let cleaned = localText;
        
        // 1. Xóa chữ cái Latinh
        cleaned = cleaned.replace(/[a-zA-Z]/g, '');
        
        // 2. Xóa hết dấu xuống dòng (Enter) -> Thay bằng rỗng ''
        cleaned = cleaned.replace(/[\n\r]+/g, '');
        
        // 3. Xóa hết các loại dấu cách (thường, tab, Nhật) -> Thay bằng rỗng ''
        // Regex này bao gồm: dấu cách thường ( ), dấu cách Nhật (　), và tab (\t)
        cleaned = cleaned.replace(/[ 　\t]+/g, ''); 
        
        // Cắt khoảng trắng thừa 2 đầu (nếu còn sót)
        cleaned = cleaned.trim();

        setLocalText(cleaned);
        handleChange('text', cleaned); 
    };


    // --- 5. XỬ LÝ NHẬP LIỆU (REAL-TIME FILTER) ---
    const handleInputText = (e) => {
        const rawInput = e.target.value;

        // Nếu đang lơ lửng gõ bộ gõ (IME) thì cứ để hiện
        if (isComposing.current) {
            setLocalText(rawInput);
            return;
        }
        
        // 1. Lọc ký tự rác (số, icon...)
        const allowedString = getAllowedRegexString(filterOptions, true);
        const blockRegex = new RegExp(`[^${allowedString}]`, 'g');
        let validForInput = rawInput.replace(blockRegex, '');

        // 2. LOGIC QUAN TRỌNG: Lọc trùng ngay lập tức
        if (filterOptions.removeDuplicates) {
            validForInput = getUniqueChars(validForInput);
        }

        setLocalText(validForInput);
        handleChange('text', validForInput.replace(/[a-zA-Z]/g, ''));
    };

    const handleCompositionStart = () => {
        isComposing.current = true;
    };

    const handleCompositionEnd = (e) => {
        isComposing.current = false;
        
        // Lấy toàn bộ nội dung trong ô nhập lúc này
        const rawInput = e.target.value;
        
        // 1. Lọc rác
        const allowedString = getAllowedRegexString(filterOptions, true);
        const blockRegex = new RegExp(`[^${allowedString}]`, 'g');
        let validForInput = rawInput.replace(blockRegex, '');

        // 2. LOGIC QUAN TRỌNG: Lọc trùng ngay khi chốt chữ
        if (filterOptions.removeDuplicates) {
            validForInput = getUniqueChars(validForInput);
        }

        setLocalText(validForInput);
        handleChange('text', validForInput.replace(/[a-zA-Z]/g, ''));
    };
// Thêm tham số type (mặc định là 'kanji')
const handleLoadFromGithub = async (url, type = 'kanji') => {
setProgress(0);
setIsLoading(true);      
setIsMenuOpen(false);    

try {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Lỗi tải dữ liệu từ ${url}`);
    }

    const rawText = await response.text();
    const cleanText = rawText.replace(/["\n\r\s,\[\]]/g, '');

    if (!cleanText) {
            alert("File dữ liệu rỗng!");
            setIsLoading(false);
            return;
    }

    
    setFilterOptions(prev => ({ ...prev, [type]: true })); 
    
    setProgress(30);
    setTimeout(() => setProgress(100), 300);

    setTimeout(() => {
        setLocalText(cleanText);              
        onChange({ ...config, text: cleanText }); 
        setIsLoading(false);                  
    }, 500);

} catch (error) {
    console.error("Lỗi:", error);
    alert("Không tải được dữ liệu. Vui lòng kiểm tra lại đường truyền hoặc link GitHub.");
    setIsLoading(false);
}
};
    // --- HÀM MỚI: Lấy ngẫu nhiên Kanji từ GitHub ---
    const handleRandomLoadFromGithub = async (level) => {
        // 1. Kiểm tra số lượng
        if (randomCount === '' || randomCount <= 0) {
            alert("Vui lòng nhập số lượng chữ cần lấy!");
            return;
        }
        setProgress(0);

        // 2. Tạo link file: kanjin5.json...
        const fileName = `kanji${level.toLowerCase()}.json`; 
        const url = `./data/${fileName}`;

        setIsLoading(true);
         // Đóng menu Tiện ích
        setIsMenuOpen(false);
        
        try {
            // 3. Tải file về
            const response = await fetch(url);
            if (!response.ok) throw new Error("Lỗi tải file");
            
            const rawText = await response.text();
            const cleanText = rawText.replace(/["\n\r\s]/g, '');

            if (!cleanText) {
                    alert("File dữ liệu rỗng!");
                    setIsLoading(false);
                    return;
            }

            // 1. Chuyển chuỗi từ file thành mảng các chữ cái
        const allChars = Array.from(cleanText);

        // 2. Phân loại: Chữ nào chưa học, chữ nào đã từng học (dựa vào srsData)
        const unstudiedChars = allChars.filter(char => !srsData[char]);
        const studiedChars = allChars.filter(char => srsData[char]);

        // 3. Giới hạn số lượng lấy (tối đa 50)
        const count = randomCount > 50 ? 50 : randomCount;

        let selectedPool = "";

        // Logic ưu tiên:
        if (unstudiedChars.length >= count) {
            // NẾU CÒN ĐỦ CHỮ MỚI: Chỉ bốc trong đống chưa học
            selectedPool = shuffleString(unstudiedChars.join('')).slice(0, count);
        } 
        else if (unstudiedChars.length > 0) {
            // NẾU CHỮ MỚI KHÔNG ĐỦ: Lấy hết chữ mới + bù thêm chữ cũ cho đủ số lượng
            const neededMore = count - unstudiedChars.length;
            const extraFromStudied = shuffleString(studiedChars.join('')).slice(0, neededMore);
            selectedPool = unstudiedChars.join('') + extraFromStudied;
        } 
        else {
            // NẾU ĐÃ HỌC HẾT SẠCH: Lấy ngẫu nhiên bất kỳ chữ nào trong file
            selectedPool = shuffleString(cleanText).slice(0, count);
        }

        // 4. Xáo trộn lần cuối để vị trí các chữ xuất hiện ngẫu nhiên
        const finalResult = shuffleString(selectedPool);

        // --- Cập nhật giao diện ---
        setFilterOptions(prev => ({ ...prev, kanji: true }));
        setProgress(30);
        
        setTimeout(() => setProgress(100), 300);

        setTimeout(() => {
            setLocalText(finalResult);
            onChange({ ...config, text: finalResult });
            setIsLoading(false);
        }, 500);
         
        } catch (error) {
            console.error(error);
            alert(`Không tải được dữ liệu ${level}. Kiểm tra lại mạng hoặc link GitHub.`);
            setIsLoading(false);
        }
    };
      // --- SỬA LẠI HÀM handleLoadMinna ---
const handleLoadMinna = async () => {
    // 1. Tính toán số bài hợp lệ ngay lập tức
    let validLesson = minnaLesson;
    
    // Nếu để trống hoặc nhỏ hơn 1 -> Về 1
    if (validLesson === '' || validLesson < 1) validLesson = 1;
    // Nếu lớn hơn 50 -> Về 50
    if (validLesson > 50) validLesson = 50;

    // 2. Cập nhật lại giao diện cho đúng số đã sửa
    setMinnaLesson(validLesson);

    // 3. Bắt đầu tải dữ liệu với số hợp lệ (validLesson)
    setProgress(0);
    setIsLoading(true);
    setIsMenuOpen(false);

    const url = `./data/tuvung/minna/minna${validLesson}.json`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Không tìm thấy file bài học này");

        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            alert("File dữ liệu bị lỗi hoặc rỗng!");
            setIsLoading(false);
            return;
        }

        const textContent = data.join('\n');
        setProgress(50);

        setTimeout(() => {
            setLocalText(textContent);
            onChange({ ...config, text: textContent });
            setProgress(100);
            setTimeout(() => setIsLoading(false), 200);
        }, 300);

    } catch (error) {
        console.error(error);
        alert(`Lỗi: Chưa có dữ liệu cho Bài ${validLesson} `);
        setIsLoading(false);
    }
};
   // --- HÀM TẢI MIMIKARA (CẬP NHẬT: Nhận Level và Part làm tham số) ---
    const handleLoadMimikara = async (level, partInput) => {
        // 1. Cấu hình giới hạn
        const limits = { N3: 12, N2: 13, N1: 14 };
        const maxPart = limits[level];

        // 2. Validate số phần
        let validPart = parseInt(partInput);
        if (isNaN(validPart) || validPart < 1) validPart = 1;
        if (validPart > maxPart) validPart = maxPart;

        // Cập nhật lại số đẹp vào ô input tương ứng
        if (level === 'N3') setMimiN3(validPart);
        if (level === 'N2') setMimiN2(validPart);
        if (level === 'N1') setMimiN1(validPart);
        
        // 3. Hiệu ứng Loading
        setProgress(0);
        setIsLoading(true);
        setIsMenuOpen(false);

        // 4. Đường dẫn file chuẩn: ./data/tuvung/mimikara/n3/mimin3p1.json
        const lvl = level.toLowerCase();
        const url = `./data/tuvung/mimikara/${lvl}/mimi${lvl}p${validPart}.json`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Không tìm thấy file");

            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                alert("File dữ liệu bị lỗi hoặc rỗng!");
                setIsLoading(false);
                return;
            }

            const textContent = data.join('\n');
            setProgress(50);

            setTimeout(() => {
                setLocalText(textContent);
                onChange({ ...config, text: textContent });
                setProgress(100);
                setTimeout(() => setIsLoading(false), 200);
            }, 300);

        } catch (error) {
            console.error(error);
            alert(`Lỗi: Không tìm thấy file dữ liệu!\nĐường dẫn: ${url}`);
            setIsLoading(false);
        }
    };
// --- HÀM TẢI TANGO (MỚI THÊM) ---
    const handleLoadTango = async (level, partInput) => {
        // 1. Cấu hình giới hạn số bài (N3, N2: 12 bài | N1: 14 bài)
        const limits = { N3: 12, N2: 12, N1: 14 };
        const maxPart = limits[level];

        // 2. Kiểm tra số hợp lệ
        let validPart = parseInt(partInput);
        if (isNaN(validPart) || validPart < 1) validPart = 1;
        if (validPart > maxPart) validPart = maxPart;

        // 3. Cập nhật lại số đẹp vào ô input
        if (level === 'N3') setTangoN3(validPart);
        if (level === 'N2') setTangoN2(validPart);
        if (level === 'N1') setTangoN1(validPart);

        // 4. Hiệu ứng Loading
        setProgress(0);
        setIsLoading(true);
        setIsMenuOpen(false);

        // 5. Đường dẫn file: data/tuvung/tango/n3/tangon3p1.json
        const lvl = level.toLowerCase();
        const url = `./data/tuvung/tango/${lvl}/tango${lvl}p${validPart}.json`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Không tìm thấy file");

            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                alert("File dữ liệu bị lỗi hoặc rỗng!");
                setIsLoading(false);
                return;
            }

            const textContent = data.join('\n');
            setProgress(50);

            setTimeout(() => {
                setLocalText(textContent);
                onChange({ ...config, text: textContent });
                setProgress(100);
                setTimeout(() => setIsLoading(false), 200);
            }, 300);

        } catch (error) {
            console.error(error);
            alert(`Lỗi: Không tìm thấy file dữ liệu!\nĐường dẫn: ${url}`);
            setIsLoading(false);
        }
    };
  // --- HÀM THÔNG MINH: TỰ KIỂM TRA XEM ĐANG NHẬP Ô NÀO ĐỂ TẢI ---
    const handleSmartLoadVocabulary = () => {
        // 1. Kiểm tra Minna
        if (minnaLesson !== '' && minnaLesson !== null) {
            handleLoadMinna();
        } 
        // 2. Kiểm tra Mimikara
        else if (mimiN3 !== '') {
            handleLoadMimikara('N3', mimiN3);
        } else if (mimiN2 !== '') {
            handleLoadMimikara('N2', mimiN2);
        } else if (mimiN1 !== '') {
            handleLoadMimikara('N1', mimiN1);
        } 
        // 3. Kiểm tra Tango (MỚI)
        else if (tangoN3 !== '') {
            handleLoadTango('N3', tangoN3);
        } else if (tangoN2 !== '') {
            handleLoadTango('N2', tangoN2);
        } else if (tangoN1 !== '') {
            handleLoadTango('N1', tangoN1);
        } 
        else {
            alert("Vui lòng nhập số bài hoặc số phần cần học!");
        }
    };

   // --- LOGIC ONBLUR: LÀM SẠCH & XÓA TRÙNG LẶP TỰ ĐỘNG ---
    const handleBlurText = () => {
        if (!localText) return;
        
        let cleaned = localText;

        if (mode === 'vocab') {
            // Chế độ TỪ VỰNG: Giữ lại xuống dòng để phân tách từ
            cleaned = cleaned.replace(/[ \t]+/g, ' '); 
            cleaned = cleaned.replace(/(\n\s*){2,}/g, '\n'); 
            cleaned = cleaned.trim();
            const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            cleaned = [...new Set(lines)].join('\n');
            if (cleaned.length > 0) cleaned += '\n'; 
        } else {
            // Chế độ KANJI: Xóa SẠCH mọi dấu cách (thường, Nhật), tab và dấu xuống dòng
            cleaned = cleaned.replace(/[\s\u3000]+/g, '');
            // Sau khi các chữ đứng sát nhau, thực hiện xóa trùng lặp
            cleaned = getUniqueChars(cleaned);
        }

        if (cleaned !== localText) {
            setLocalText(cleaned);
            onChange({ ...config, text: cleaned.replace(/[a-zA-Z]/g, '') });
        }
    };
    // --- CÁC HÀM TIỆN ÍCH KHÁC ---
    const handleSmartLoad = (content, type = null) => {
        if (!content) return;
        setIsLoading(true); setIsMenuOpen(false); setIsUtilsOpen(false); setIsConfigOpen(false); setProgress(0);
        
        if (type) setFilterOptions(prev => ({ ...prev, [type]: true }));
        else if (type === 'all') setFilterOptions(prev => ({ ...prev, kanji: true }));

        const interval = setInterval(() => {
            setProgress((prev) => { if (prev >= 90) return 90; return prev + Math.floor(Math.random() * 10) + 5; });
        }, 80);
        setTimeout(() => {
            setLocalText(content);
            onChange({ ...config, text: content });
            clearInterval(interval); setProgress(100); setTimeout(() => setIsLoading(false), 200);
        }, 600);
    };


 const handleShuffleCurrent = () => {
        if (!config.text) { alert("Chưa có nội dung!"); return; }
        
        let newContent = "";

        if (mode === 'vocab') {
            // === CHẾ ĐỘ TỪ VỰNG: Xáo trộn (Hỗ trợ xuống dòng và chấm phẩy) ===
            // 1. Tách bằng Regex: Xuống dòng HOẶC dấu chấm phẩy
            const lines = config.text.split(/[\n;]+/).filter(line => line.trim() !== '');
            
            // 2. Xáo trộn
            for (let i = lines.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [lines[i], lines[j]] = [lines[j], lines[i]];
            }
            
            // 3. Gộp lại (Chuẩn hóa về xuống dòng cho đẹp)
            newContent = lines.join('\n');
        } else {
            // === CHẾ ĐỘ KANJI (Như cũ) ===
            newContent = shuffleString(config.text);
        }

        handleSmartLoad(newContent);
    };

    // Hàm xử lý tìm kiếm thời gian thực
const handleSearchRealtime = (val) => {
setSearchTerm(val);
const query = val.toLowerCase().trim();
const queryNoAccent = removeAccents(query);

if (!query) {
    setSearchResults([]);
    return;
}

let matches = [];

 if (mode === 'vocab') {
            // 1. KIỂM TRA: Nếu không có chữ Hán nào trong ô nhập -> Dừng ngay lập tức
            // (Nghĩa là gõ tiếng Việt/Latinh sẽ không ra kết quả gì)
            const isInputKanji = query.match(/[\u4E00-\u9FAF]/);
            
            if (!isInputKanji) {
                setSearchResults([]);
                return;
            }

            // 2. TÌM KIẾM: Quét danh sách từ vựng
            if (dbData.TUVUNG_DB) {
                Object.entries(dbData.TUVUNG_DB).forEach(([word, info]) => {
                    // Kiểm tra: Từ vựng (word) có chứa chữ Hán người dùng vừa nhập không?
                    if (word.includes(val.trim())) {
                        matches.push({
                            char: word,
                            sound: info.reading,
                            type: 'vocab',
                            priority: 1, // Mặc định ưu tiên cao nhất
                            length: word.length
                        });
                    }
                });
            }

            // 3. SẮP XẾP: Từ ngắn xếp trước, từ dài xếp sau
            matches.sort((a, b) => a.length - b.length);

            // 4. LỌC TRÙNG: Loại bỏ các từ quá giống nhau (ví dụ: có 'ăn' rồi thì bỏ 'ăn cơm')
            const uniqueMatches = [];
            matches.forEach(current => {
                const isRedundant = uniqueMatches.some(base => {
                    // Nếu từ hiện tại bắt đầu bằng từ gốc đã có (VD: 食事 vs 食事する)
                    if (current.char.startsWith(base.char)) {
                         // Chỉ loại bỏ nếu đuôi là 'masu' hoặc 'shimasu' (động từ chia thể)
                         if (current.char.endsWith('ます') || current.char.endsWith('します')) {
                             return true; 
                         }
                    }
                    return false;
                });

                if (!isRedundant) {
                    uniqueMatches.push(current);
                }
            });
            matches = uniqueMatches;
        }
     
  else {  
const processData = (source, type) => {
    Object.entries(source).forEach(([char, info]) => {
        if (info.sound) {
            const sound = info.sound.toLowerCase();
            const soundNoAccent = removeAccents(sound);

            // Tính toán trọng số ưu tiên (Càng thấp càng đứng đầu)
            let priority = 99;

            if (sound === query) priority = 1; // 1. Khớp chính xác (An -> AN)
            else if (soundNoAccent === queryNoAccent) priority = 2; // 2. Khớp chính xác không dấu (An -> ÁN)
            else if (sound.includes(query)) priority = 3; // 3. Chứa vần chính xác (An -> SAN)
            else if (soundNoAccent.includes(queryNoAccent)) priority = 4; // 4. Chứa vần không dấu (An -> HÁN)

            if (priority < 99) {
                matches.push({ char, ...info, type, priority, sound });
            }
        }
    });
};

processData(dbData.KANJI_DB, 'kanji');

// Sắp xếp theo trọng số, nếu cùng trọng số thì xếp theo Alphabet
matches.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.sound.localeCompare(b.sound);
});
}
setSearchResults(matches.slice(0, 20));
setActiveIndex(0); // Reset về vị trí đầu tiên
};
// --- HÀM CHỌN TẤT CẢ KẾT QUẢ TÌM KIẾM (MỚI) ---
    const handleSelectAllResults = () => {
        if (searchResults.length === 0) return;

        // 1. Lấy tất cả các từ trong danh sách kết quả
        const wordsToAdd = searchResults.map(item => item.char).join('\n');

        // 2. Nối vào nội dung hiện tại
        let currentText = localText || "";
        // Nếu cuối chuỗi chưa có xuống dòng thì thêm vào để không bị dính
        if (currentText.length > 0 && !currentText.endsWith('\n')) {
            currentText += '\n';
        }
        
        let newText = currentText + wordsToAdd + '\n';

        // 3. Kiểm tra lọc trùng (nếu đang bật option)
        if (filterOptions.removeDuplicates) {
             const lines = newText.split(/[\n;]+/).map(l => l.trim()).filter(l => l);
             newText = [...new Set(lines)].join('\n') + '\n';
        }

        // 4. Cập nhật dữ liệu & Reset tìm kiếm
        setLocalText(newText);
        handleChange('text', newText);
        setSearchTerm('');
        setSearchResults([]);
        searchInputRef.current.focus();
    };
   // --- HÀM CHỌN KẾT QUẢ (CẬP NHẬT CHO TỪ VỰNG) ---
const selectResult = (item) => {
    // 1. Tạo chuỗi mới
    let newText = "";
    
    if (mode === 'vocab') {
        // Chế độ từ vựng: Thêm từ + xuống dòng
        // Nếu ô đang trống thì không cần xuống dòng ở đầu
        const separator = config.text.length > 0 && !config.text.endsWith('\n') ? '\n' : '';
        newText = config.text + separator + item.char + '\n';
    } else {
        // Chế độ Kanji: Nối liền
        newText = config.text + item.char;
    }

    // 2. KIỂM TRA: Lọc trùng (nếu đang bật)
    if (filterOptions.removeDuplicates) {
        if (mode === 'vocab') {
             // Lọc trùng theo dòng cho từ vựng
             const lines = newText.split('\n').map(l=>l.trim()).filter(l=>l);
             newText = [...new Set(lines)].join('\n') + '\n';
        } else {
             // Lọc trùng ký tự cho Kanji
             newText = getUniqueChars(newText);
        }
    }

    // 3. Cập nhật State
    setLocalText(newText);
    handleChange('text', newText);

    // 4. Reset tìm kiếm
    setSearchTerm('');
    setSearchResults([]);
    setActiveIndex(0);

    // 5. Bật bộ lọc hiển thị (để người dùng thấy ngay kết quả)
    if (mode === 'kanji') {
        if (item.type === 'kanji') setFilterOptions(p => ({...p, kanji: true}));
    }
    // Với từ vựng thì không cần bật tắt filter Hiragana/Katakana vì từ vựng chứa lộn xộn
};
    
    const toggleMenu = (menuName) => {
        setIsCafeModalOpen(false); 
        setIsFilterMenuOpen(false); 
        if (menuName === 'quick') { setIsMenuOpen(!isMenuOpen); setIsUtilsOpen(false); setIsConfigOpen(false); }
        else if (menuName === 'utils') { setIsUtilsOpen(!isUtilsOpen); setIsMenuOpen(false); setIsConfigOpen(false); }
        else if (menuName === 'config') { setIsConfigOpen(!isConfigOpen); setIsMenuOpen(false); setIsUtilsOpen(false); }
    };

    // Check warning để đổi font placeholder
    const isWarningMode = !filterOptions.hiragana && !filterOptions.katakana && !filterOptions.kanji;

    return (
        <div className="w-full md:w-96 bg-white shadow-xl p-6 flex flex-col gap-6 h-auto md:h-screen md:overflow-y-auto relative md:sticky top-0 border-r border-gray-200 z-50 hide-scrollbar">
        
        {/* HEADER */}
<div className="mb-4 pb-3 border-b border-gray-100"> 
    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-1.5 mb-1">
        <span className="text-2xl leading-none -mt-1">⛩️</span>
        {mode === 'kanji' ? 'TẠO FILE TẬP VIẾT KANJI' : 'TẠO FILE TẬP VIẾT TỪ VỰNG'}
    </h1>
</div>

        <div className="space-y-6 flex-1">
            
{/* TÌM KIẾM THÔNG MINH (BƯỚC 3) */}
<div className="space-y-1.5 pb-2 mb-2 relative">
    <div className="flex gap-2">
        <div className="relative flex-1">
            {/* Icon Kính lúp */}
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                    className={mode === 'vocab' ? 'text-emerald-500' : 'text-indigo-500'}
                >
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
            </div>

            {/* Ô Input */}
            <input 
                ref={searchInputRef}
                type="text" 
                value={searchTerm} 
                className={`w-full pl-10 py-2 border rounded-lg text-[16px] focus:outline-none focus:ring-2 font-bold font-sans ${
                    // Padding động để tránh đè nút Chọn tất
                    (mode === 'vocab' && searchResults.length > 0) ? 'pr-28' : 'pr-10'
                } ${
                    mode === 'vocab' 
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 placeholder-emerald-400 focus:ring-emerald-500' 
                    : 'border-indigo-200 bg-indigo-50 text-indigo-900 placeholder-indigo-400 focus:ring-indigo-500'
                }`}
                // --- THAY ĐỔI PLACEHOLDER Ở ĐÂY ---
                placeholder={mode === 'vocab' ? "Tìm từ vựng đi kèm kanji" : "Tìm Kanji theo âm Hán Việt"}
                // -----------------------------------
                onChange={(e) => handleSearchRealtime(e.target.value)} 
                onKeyDown={(e) => {
                    if (searchResults.length > 0) {
                        if (e.key === 'ArrowDown') { 
                            e.preventDefault(); 
                            setActiveIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0)); 
                        } else if (e.key === 'ArrowUp') { 
                            e.preventDefault(); 
                            setActiveIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1)); 
                        } else if (e.key === 'Enter') { 
                            e.preventDefault(); 
                            selectResult(searchResults[activeIndex]); 
                        }
                    }
                }}
            />

            {/* --- CỤM NÚT BÊN PHẢI (CHỌN TẤT + XÓA) --- */}
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                {/* NÚT CHỌN TẤT */}
                {mode === 'vocab' && searchResults.length > 0 && (
                    <button 
                        onClick={handleSelectAllResults}
                        className="text-[9px] font-black text-white bg-emerald-500 hover:bg-emerald-600 px-2 py-1 rounded shadow-sm transition-all active:scale-95 animate-in fade-in zoom-in duration-200 whitespace-nowrap"
                        title={`Thêm toàn bộ ${searchResults.length} từ vào danh sách`}
                    >
                        CHỌN TẤT ({searchResults.length})
                    </button>
                )}

                {/* NÚT X ĐỂ XÓA */}
                {searchTerm && (
                    <button 
                        onClick={() => {
                            setSearchTerm('');    
                            setSearchResults([]); 
                            searchInputRef.current.focus();
                        }}
                        className={`p-1 rounded-full transition-colors ${
                            mode === 'vocab' ? 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-100' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-100'
                        }`}
                        title="Xóa tìm kiếm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                )}
            </div>
        </div>
    </div>

    {/* --- CHÚ THÍCH NHỎ DƯỚI THANH TÌM KIẾM (MỚI) --- */}
    {mode === 'vocab' && (
        <p className="text-[9px] text-gray-400 italic ml-1 -mt-1 font-medium animate-in fade-in slide-in-from-top-1">
            *Nhập 1 chữ Kanji để tìm từ vựng đi kèm
        </p>
    )}

    {/* DROPDOWN KẾT QUẢ GỢI Ý */}
    {searchResults.length > 0 && (
        <div 
            ref={scrollRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-[70] max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200"
        >
            {searchResults.map((item, idx) => {
                const level = item.type === 'kanji' ? getJLPTLevel(item.char) : null; 

                return (
                    <div 
                        key={idx} 
                        onClick={() => selectResult(item)}
                        className={`flex items-center gap-3 p-3 cursor-pointer border-b border-gray-50 last:border-none transition-colors group ${
                            idx === activeIndex ? 'bg-indigo-100' : 'bg-white hover:bg-indigo-50'
                        }`}
                    >
                        <span className={`font-['Klee_One'] text-black group-hover:scale-105 transition-transform ${mode === 'vocab' ? "text-xl" : "text-2xl"}`}>
                            {item.char}
                        </span>

                        <div className="flex flex-col justify-center">
                            <span className={`text-sm font-bold uppercase leading-tight truncate ${mode === 'vocab' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                {item.sound} 
                            </span>
                        </div>

                        <div className="ml-auto flex-shrink-0">
                            {mode !== 'vocab' && (
                                level ? (
                                    <div className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${levelColors[level]}`}>
                                        {level}
                                    </div>
                                ) : (
                                    <div className="px-1.5 py-0.5 rounded text-[9px] font-black border bg-gray-100 text-gray-500 border-gray-200 uppercase">
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
            {/* KHUNG NHẬP LIỆU */}
            <div className="space-y-2 pt-2">
                {/* --- TIÊU ĐỀ & CÁC NÚT (ĐÃ CHỈNH SỬA GIAO DIỆN) --- */}
                <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 font-sans">Nhập dữ liệu</label>
                
                {/* CỤM NÚT BỘ LỌC VÀ XÓA */}
                <div className="flex items-center gap-3 relative">
                    
                    {/* 1. NÚT MỞ BỘ LỌC */}
                    {mode !== 'vocab' && (
                    <div className="relative" ref={filterRef}>
                        <button 
                            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded transition-colors ${isFilterMenuOpen ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-700'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            BỘ LỌC
                        </button>

                        {/* POPUP MENU BỘ LỌC */}
                        {isFilterMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">BỘ LỌC</span>
                                    <div className="group relative cursor-help">
                                        <div className="text-gray-400 hover:text-indigo-500 border border-gray-300 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] font-serif font-bold bg-gray-50">i</div>
                                        {/* Tooltip chữ i */}
                                        <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-gray-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-[60]">
                                            1. Bỏ tích ô nào, chữ loại đó sẽ bị xóa ngay lập tức khỏi ô nhập liệu. <br/>
                                            2. "LÀM SẠCH" sẽ xóa hết chữ latinh, khoảng trắng thừa trong ô nhập liệu.
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2.5">
                                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-indigo-600 select-none">
                                        <input type="checkbox" checked={filterOptions.kanji} onChange={() => handleFilterChange('kanji')} className="accent-indigo-600 w-3.5 h-3.5 rounded-sm"/>
                                        Kanji & Bộ thủ
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-indigo-600 select-none">
                                        <input type="checkbox" checked={filterOptions.hiragana} onChange={() => handleFilterChange('hiragana')} className="accent-indigo-600 w-3.5 h-3.5 rounded-sm"/>
                                        Hiragana
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-indigo-600 select-none">
                                        <input type="checkbox" checked={filterOptions.katakana} onChange={() => handleFilterChange('katakana')} className="accent-indigo-600 w-3.5 h-3.5 rounded-sm"/>
                                        Katakana
                                    </label>
                                    {/* ĐƯỜNG KẺ MỜ NGĂN CÁCH (MỚI) */}
                                    <hr className="border-gray-100 my-1"/>

{/* TÙY CHỌN: XÓA TRÙNG LẶP (ĐỔI MÀU ĐỘNG) */}
<label className={`flex items-center gap-2 text-xs cursor-pointer select-none transition-colors ${
filterOptions.removeDuplicates 
    ? 'text-red-500 hover:text-red-600'  // Khi ĐANG TÍCH: Màu đỏ đậm
    : 'text-gray-700 hover:text-indigo-600'        // Khi KHÔNG TÍCH: Màu xám bình thường
}`}>
<input 
    type="checkbox" 
    checked={filterOptions.removeDuplicates} 
    onChange={() => handleFilterChange('removeDuplicates')} 
    className={`w-3.5 h-3.5 rounded-sm ${
        filterOptions.removeDuplicates ? 'accent-red-500' : 'accent-indigo-500'
    }`}
/>
Xóa chữ trùng lặp
</label>
                                    
                                    <hr className="border-gray-100"/>
                                    
{/* NÚT LÀM SẠCH  */}
<button 
onClick={handleRemoveLatinManual} 
className="w-full py-2 text-xs font-bold text-green-600 bg-green-50 md:hover:bg-green-100 active:bg-green-100 rounded-lg flex items-center justify-center gap-1 transition active:scale-95">
LÀM SẠCH
</button>
                                </div>
                            </div>
                        )}
                    </div>
)}
                    {/* 2. NÚT XÓA TẤT CẢ */}
                    <button onClick={() => { setLocalText(''); handleChange('text', ''); }} className="flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-tighter">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> XÓA TẤT CẢ
                    </button>
                </div>
                </div>
                <textarea 
                className={`w-full h-[104px] p-3 pr-1 border border-gray-300 rounded-lg resize-none text-lg bg-white text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner input-scrollbar ${(isWarningMode && !localText) ? 'font-sans' : "font-['Klee_One']"}`}
                placeholder={getDynamicPlaceholder()} 
                value={localText} 
                onChange={handleInputText} 
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onBlur={handleBlurText}   
                    onKeyDown={(e) => {
        if (e.key === 'Enter') {
            const _d = (s) => {
                try { return decodeURIComponent(escape(window.atob(s))); } catch{ return ''; }
            };
            const _k = 'cGhhZGFvdGllbmduaGF0'; 
            const _m = 'QuG6o24gcXV54buBbiB0cmFuZyB3ZWIgdGh14buZYyBQaMOhIMSQ4bqjbyBUaeG6v25nIE5o4bqtdA==';
            if (e.target.value.trim().toLowerCase() === _d(_k)) {
                e.preventDefault(); 
                alert(_d(_m));   
                setLocalText('');
                handleChange('text', '');
            }
        }
    }}
                />
            </div>
            
           {mode === 'kanji' && dueChars.length > 0 && (
    <div className="mb-6 animate-in slide-in-from-top duration-500">
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center animate-bounce shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m12 8 4 4-4 4"/><path d="M8 12h7"/><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10 10-4.48 10-10z"/></svg>
                </div>
                <div>
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Hệ thống nhắc nhở</p>
                    <p className="text-sm font-black text-orange-700">CẦN ÔN {dueChars.length} CHỮ!</p>
                </div>
            </div>
            
            {/* NÚT CHIA ĐÔI */}
            <div className="flex gap-2">
                <button onClick={handleLoadDueCards} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black rounded-xl transition-all shadow-md shadow-orange-200 active:scale-95 uppercase">
                    Ôn ngay
                </button>
                <button onClick={onOpenReviewList} className="flex-1 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-600 text-[10px] font-black rounded-xl transition-all border border-orange-200 active:scale-95 uppercase">
                    danh sách
                </button>
            </div>
        </div>
    </div>
)}
            <div className="flex flex-col gap-3 w-full">
                
                {/* HÀNG 3 NÚT */}
                <div className="flex flex-row gap-4 w-full h-12">
                    
               {/* 1. MENU CHỌN NHANH (Quick Select) */}
<div className="relative flex-1" ref={quickMenuRef}>
    <button onClick={() => toggleMenu('quick')} className={`w-full h-full px-1 border rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-[0.98] ${isMenuOpen ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
        <span className="font-bold text-xs whitespace-nowrap">CHỌN NHANH</span>
    </button>

    {isMenuOpen && (
        <>
            {/* ========================================================= */}
            {/* TRƯỜNG HỢP 1: KANJI - GIỮ NGUYÊN GIAO DIỆN DROPDOWN CŨ */}
            {/* ========================================================= */}
            {mode === 'kanji' ? (
                <div className="absolute bottom-full left-0 mb-2 z-50 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    {/* --- PHẦN GỘP: BẢNG CHỮ CÁI & BỘ THỦ --- */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 text-left">Bảng chữ cái & Bộ thủ</p>
                        <div className="grid grid-cols-3 gap-1.5">
                            <button onClick={() => handleLoadFromGithub('./data/hiragana.json', 'hiragana')} className="py-2 text-[11px] font-bold bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-black hover:text-white transition truncate" title="Hiragana">あ Hira</button>
                            <button onClick={() => handleLoadFromGithub('./data/katakana.json', 'katakana')} className="py-2 text-[11px] font-bold bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-black hover:text-white transition truncate" title="Katakana">ア Kata</button>
                            <button onClick={() => handleLoadFromGithub('./data/bothu.json')} className="py-2 text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-600 hover:text-white transition truncate" title="Bộ thủ cơ bản">Bộ thủ</button>
                        </div>
                    </div>

                    {/* Lấy tất cả Kanji */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 text-left">Lấy tất cả Kanji</p>
                        <div className="grid grid-cols-5 gap-1.5">
                            {['N5', 'N4', 'N3', 'N2', 'N1'].map((level) => (
                                <button key={level} onClick={() => { const fileName = `kanji${level.toLowerCase()}.json`; const url = `./data/${fileName}`; handleLoadFromGithub(url); }} className={`py-2 text-[11px] font-black border rounded-md transition-all duration-200 active:scale-95 ${levelColors[level]}`}>
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lấy ngẫu nhiên */}
                    <div>
                        <div className="flex justify-start items-center gap-2 mb-2 mt-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Lấy ngẫu nhiên</p>
                            <div className="flex items-center gap-1.5">
                                <input type="number" min="0" max="50" value={randomCount} onChange={(e) => { const val = e.target.value; if (val === '') setRandomCount(''); else setRandomCount(parseInt(val)); }} onKeyDown={(e) => { if (e.key === 'Enter' && randomCount > 50) setRandomCount(50) }} onBlur={() => { if (randomCount > 50) setRandomCount(50) }} className="w-10 h-6 text-[16px] text-center font-bold bg-gray-50 border border-gray-200 text-gray-700 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase">chữ</span>
                            </div>
                            <div className="group relative cursor-help ml-auto">
                                <div className="text-gray-400 hover:text-indigo-500 border border-gray-300 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] font-serif font-bold bg-gray-50 transition-colors">i</div>
                                <div className="absolute right-0 bottom-full mb-2 w-56 p-2.5 bg-gray-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-2xl z-[70] leading-relaxed border border-white/10">
                                    <div className="font-black text-indigo-400 mb-1 uppercase text-[9px] flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        Học tập thông minh
                                    </div>
                                    Hệ thống ưu tiên lấy những chữ bạn <b>chưa học Flashcard bao giờ</b>. Nếu đã hết chữ mới, hệ thống sẽ lấy thêm chữ cũ để đủ số lượng yêu cầu.
                                    <div className="absolute top-full right-1 -mt-1 w-2 h-2 bg-gray-900 rotate-45 border-r border-b border-white/10"></div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                            {['N5', 'N4', 'N3', 'N2', 'N1'].map((level) => (
                                <button key={`rand-${level}`} onClick={() => handleRandomLoadFromGithub(level)} className={`py-2 text-[11px] font-black border rounded-md transition-all duration-200 active:scale-95 ${levelColors[level]}`}>
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                // =========================================================
                // TRƯỜNG HỢP 2: TỪ VỰNG - HIỆN MODAL GIỮA MÀN HÌNH (MỚI)
                // =========================================================
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 cursor-pointer" onClick={() => setIsMenuOpen(false)}>
                    
                    {/* CONTAINER MODAL */}
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
                        
                        {/* --- HEADER CỦA MODAL (CÓ NÚT X) --- */}
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                                <span className="text-lg">📚</span> CHỌN NHANH TỪ VỰNG
                            </h3>
                            <button 
                                onClick={() => setIsMenuOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-500 hover:text-white transition-all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                       {/* 1. MINNA NO NIHONGO */}

<div className="flex items-center justify-between group hover:bg-gray-50 p-1.5 rounded-lg transition-colors -mx-1.5">
    

    <label className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1.5">
        MINNA NO NIHONGO
    </label>
    
    <div className="flex items-center gap-2">

        <span className="text-gray-500 font-bold text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">BÀI</span>
        
        <input 
            type="number" min="1" max="50" placeholder="..."
            value={minnaLesson}
            onKeyDown={(e) => {
                if (e.key === 'Enter') { handleSmartLoadVocabulary(); return; }
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                if (!/[0-9]/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault(); 
                }
            }}
            onChange={(e) => { 
                setMinnaLesson(e.target.value); 
                if(e.target.value) { 
                    setMimiN3(''); setMimiN2(''); setMimiN1(''); 
                    setTangoN3(''); setTangoN2(''); setTangoN1(''); 
                } 
            }}
            onBlur={() => { 
                if (Number(minnaLesson) > 50) setMinnaLesson(50); 
                if (Number(minnaLesson) < 1 && minnaLesson !== '') setMinnaLesson(1); 
            }}

            className={`w-14 text-center font-bold border-b-2 focus:border-emerald-500 outline-none bg-transparent transition-all text-[16px] pb-0.5 ${minnaLesson !== '' ? 'text-emerald-600 border-emerald-500' : 'text-gray-400 border-gray-200'}`}
        />
    </div>
</div>

                       {/* 2. MIMIKARA (N3, N2, N1) */}
<div className="space-y-2">
    {/* MIMI N3 */}
    <div className="flex items-center justify-between group hover:bg-gray-50 p-1.5 rounded-lg transition-colors -mx-1.5">
        {/* ĐÃ XÓA ICON, CHỈ CÒN TEXT */}
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            MIMIKARA OBOERU N3
        </label>
        <div className="flex items-center gap-2">
            <span className="text-gray-500 font-bold text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">PHẦN</span>
            <input 
                type="number" min="1" max="12" placeholder="..." 
                value={mimiN3} 
onKeyDown={(e) => {
                if (e.key === 'Enter') { handleSmartLoadVocabulary(); return; }
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                if (!/[0-9]/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault(); 
                }
            }}
                onChange={(e) => { setMimiN3(e.target.value); if (e.target.value) { setMinnaLesson(''); setMimiN2(''); setMimiN1(''); setTangoN3(''); setTangoN2(''); setTangoN1(''); } }} 
                onBlur={() => { if (Number(mimiN3) > 12) setMimiN3(12); if (Number(mimiN3) < 1 && mimiN3 !== '') setMimiN3(1); }} 
            
                className={`w-14 text-center font-bold border-b-2 focus:border-amber-500 outline-none bg-transparent transition-all text-[16px] pb-0.5 ${mimiN3 !== '' ? 'text-amber-600 border-amber-500' : 'text-gray-400 border-gray-200'}`} 
               
            />
        </div>
    </div>

    {/* MIMI N2 */}
    <div className="flex items-center justify-between group hover:bg-gray-50 p-1.5 rounded-lg transition-colors -mx-1.5">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            MIMIKARA OBOERU N2
        </label>
        <div className="flex items-center gap-2">
            <span className="text-gray-500 font-bold text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">PHẦN</span>
            <input 
                type="number" min="1" max="13" placeholder="..." 
                value={mimiN2} 
onKeyDown={(e) => {
                if (e.key === 'Enter') { handleSmartLoadVocabulary(); return; }
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                if (!/[0-9]/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault(); 
                }
            }}
                onChange={(e) => { setMimiN2(e.target.value); if (e.target.value) { setMinnaLesson(''); setMimiN3(''); setMimiN1(''); setTangoN3(''); setTangoN2(''); setTangoN1(''); } }} 
                onBlur={() => { if (Number(mimiN2) > 13) setMimiN2(13); if (Number(mimiN2) < 1 && mimiN2 !== '') setMimiN2(1); }} 
                className={`w-14 text-center font-bold border-b-2 focus:border-blue-500 outline-none bg-transparent transition-all text-[16px] pb-0.5 ${mimiN2 !== '' ? 'text-blue-600 border-blue-500' : 'text-gray-400 border-gray-200'}`} 
            />
        </div>
    </div>

    {/* MIMI N1 */}
    <div className="flex items-center justify-between group hover:bg-gray-50 p-1.5 rounded-lg transition-colors -mx-1.5">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            MIMIKARA OBOERU N1
        </label>
        <div className="flex items-center gap-2">
            <span className="text-gray-500 font-bold text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">PHẦN</span>
            <input 
                type="number" min="1" max="14" placeholder="..." 
                value={mimiN1} 
onKeyDown={(e) => {
                if (e.key === 'Enter') { handleSmartLoadVocabulary(); return; }
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                if (!/[0-9]/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault(); 
                }
            }}
                onChange={(e) => { setMimiN1(e.target.value); if (e.target.value) { setMinnaLesson(''); setMimiN3(''); setMimiN2(''); setTangoN3(''); setTangoN2(''); setTangoN1(''); } }} 
                onBlur={() => { if (Number(mimiN1) > 14) setMimiN1(14); if (Number(mimiN1) < 1 && mimiN1 !== '') setMimiN1(1); }} 
                className={`w-14 text-center font-bold border-b-2 focus:border-red-500 outline-none bg-transparent transition-all text-[16px] pb-0.5 ${mimiN1 !== '' ? 'text-red-600 border-red-500' : 'text-gray-400 border-gray-200'}`} 
            />
        </div>
    </div>
</div>
                      {/* 3. TANGO (N3, N2, N1) */}
<div className="space-y-2">
    {/* TANGO N3 */}
    <div className="flex items-center justify-between group hover:bg-gray-50 p-1.5 rounded-lg transition-colors -mx-1.5">
        {/* ĐÃ XÓA ICON */}
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            TANGO N3
        </label>
        <div className="flex items-center gap-2">
            <span className="text-gray-500 font-bold text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">PHẦN</span>
            <input 
                type="number" min="1" max="12" placeholder="..." 
                value={tangoN3} 
onKeyDown={(e) => {
                if (e.key === 'Enter') { handleSmartLoadVocabulary(); return; }
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                if (!/[0-9]/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault(); 
                }
            }}
                onChange={(e) => { setTangoN3(e.target.value); if (e.target.value) { setMinnaLesson(''); setMimiN3(''); setMimiN2(''); setMimiN1(''); setTangoN2(''); setTangoN1(''); } }} 
                onBlur={() => { if (Number(tangoN3) > 12) setTangoN3(12); if (Number(tangoN3) < 1 && tangoN3 !== '') setTangoN3(1); }} 
                // --- ĐỔI text-lg THÀNH text-[16px] ---
                className={`w-14 text-center font-bold border-b-2 focus:border-pink-500 outline-none bg-transparent transition-all text-[16px] pb-0.5 ${tangoN3 !== '' ? 'text-pink-600 border-pink-500' : 'text-gray-400 border-gray-200'}`} 
            />
        </div>
    </div>

    {/* TANGO N2 */}
    <div className="flex items-center justify-between group hover:bg-gray-50 p-1.5 rounded-lg transition-colors -mx-1.5">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            TANGO N2
        </label>
        <div className="flex items-center gap-2">
            <span className="text-gray-500 font-bold text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">PHẦN</span>
            <input 
                type="number" min="1" max="12" placeholder="..." 
                value={tangoN2} 
onKeyDown={(e) => {
                if (e.key === 'Enter') { handleSmartLoadVocabulary(); return; }
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                if (!/[0-9]/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault(); 
                }
            }}
                onChange={(e) => { setTangoN2(e.target.value); if (e.target.value) { setMinnaLesson(''); setMimiN3(''); setMimiN2(''); setMimiN1(''); setTangoN3(''); setTangoN1(''); } }} 
                onBlur={() => { if (Number(tangoN2) > 12) setTangoN2(12); if (Number(tangoN2) < 1 && tangoN2 !== '') setTangoN2(1); }} 
                className={`w-14 text-center font-bold border-b-2 focus:border-rose-500 outline-none bg-transparent transition-all text-[16px] pb-0.5 ${tangoN2 !== '' ? 'text-rose-600 border-rose-500' : 'text-gray-400 border-gray-200'}`} 
            />
        </div>
    </div>

    {/* TANGO N1 */}
    <div className="flex items-center justify-between group hover:bg-gray-50 p-1.5 rounded-lg transition-colors -mx-1.5">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            TANGO N1
        </label>
        <div className="flex items-center gap-2">
            <span className="text-gray-500 font-bold text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">PHẦN</span>
            <input 
                type="number" min="1" max="14" placeholder="..." 
                value={tangoN1} 
onKeyDown={(e) => {
                if (e.key === 'Enter') { handleSmartLoadVocabulary(); return; }
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                if (!/[0-9]/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault(); 
                }
            }}
                onChange={(e) => { setTangoN1(e.target.value); if (e.target.value) { setMinnaLesson(''); setMimiN3(''); setMimiN2(''); setMimiN1(''); setTangoN3(''); setTangoN2(''); } }} 
                onBlur={() => { if (Number(tangoN1) > 14) setTangoN1(14); if (Number(tangoN1) < 1 && tangoN1 !== '') setTangoN1(1); }} 
                className={`w-14 text-center font-bold border-b-2 focus:border-purple-500 outline-none bg-transparent transition-all text-[16px] pb-0.5 ${tangoN1 !== '' ? 'text-purple-600 border-purple-500' : 'text-gray-400 border-gray-200'}`} 
            />
        </div>
    </div>
</div>
                            {/* NÚT TẢI */}
                            <div className="pt-2">
                                <button
                                    onClick={handleSmartLoadVocabulary}
                                    disabled={!minnaLesson && !mimiN3 && !mimiN2 && !mimiN1 && !tangoN3 && !tangoN2 && !tangoN1}
                                    className={`w-full py-3.5 font-black text-xs rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-wide flex items-center justify-center gap-2 
                                        ${(!minnaLesson && !mimiN3 && !mimiN2 && !mimiN1 && !tangoN3 && !tangoN2 && !tangoN1)
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                                        }`}
                                >
                                    {(!minnaLesson && !mimiN3 && !mimiN2 && !mimiN1 && !tangoN3 && !tangoN2 && !tangoN1) ? (
                                        <span>Nhập số để chọn...</span>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            <span>
                                                {minnaLesson && `TẢI MINNA BÀI ${minnaLesson}`}
                                                {mimiN3 && `TẢI MIMI N3 - PHẦN ${mimiN3}`}
                                                {mimiN2 && `TẢI MIMI N2 - PHẦN ${mimiN2}`}
                                                {mimiN1 && `TẢI MIMI N1 - PHẦN ${mimiN1}`}
                                                {tangoN3 && `TẢI TANGO N3 - PHẦN ${tangoN3}`}
                                                {tangoN2 && `TẢI TANGO N2 - PHẦN ${tangoN2}`}
                                                {tangoN1 && `TẢI TANGO N1 - PHẦN ${tangoN1}`}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )}
</div>

{/* 2. MENU TIỆN ÍCH (Utilities) */}
<div className="relative flex-1" ref={utilsMenuRef}> 
    <button onClick={() => toggleMenu('utils')} className={`w-full h-full px-1 border rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-[0.98] ${isUtilsOpen ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
        <span className="font-bold text-xs whitespace-nowrap">TIỆN ÍCH</span>
    </button>

    {isUtilsOpen && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            {/* 1. CÔNG CỤ XÁO TRỘN */}
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 text-left">Công cụ</p>
                                <button 
                                    onClick={handleShuffleCurrent} 
                                    className={`w-full py-2.5 text-xs font-bold border rounded-lg transition flex items-center justify-center gap-2 ${
                                        mode === 'vocab' 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white' 
                                        : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white'
                                    }`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                    Xáo trộn danh sách hiện tại
                                </button>
                            </div>

                            {/* 2. PHẦN HỌC & ÔN TẬP */}
                            <div className="pt-0">
                                <div className="flex items-center gap-2 mb-3">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">HỌC & ÔN TẬP</p>
                                    <span className="flex-1 border-b border-gray-50"></span>
                                </div>

                                <div className="space-y-2">
                                    {/* NÚT HỌC (GAME) */}
                                    <button 
                                        onClick={() => {
                                            if (!config.text) return alert("Vui lòng nhập chữ để học!");
                                            setIsLearnGameOpen(true); 
                                            setIsUtilsOpen(false);
                                        }}
                                        className={`w-full py-3 text-white rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 group ${
                                            mode === 'vocab' ? 'bg-emerald-600 md:hover:bg-emerald-700' : 'bg-[#4255ff] md:hover:bg-[#3243cc]'
                                        }`}
                                    >
                                        <span className="bg-white p-0.5 rounded flex items-center justify-center group-hover:rotate-12 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mode === 'vocab' ? '#059669' : '#4255ff'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 13v.01M18 11v.01"/>
                                            </svg>
                                        </span>
                                        <span className="text-xs font-black tracking-wide uppercase">HỌC</span>
                                    </button>

                                    {/* NÚT FLASHCARD */}
                                    <button 
                                        onClick={() => {
                                            if (!config.text) return alert("Vui lòng nhập chữ vào ô để học flashcard!");
                                            setIsFlashcardOpen(true);
                                            setIsUtilsOpen(false);
                                        }}
                                        className={`w-full py-3 text-white rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 group ${
                                            mode === 'vocab' ? 'bg-emerald-600 md:hover:bg-emerald-700' : 'bg-[#4255ff] md:hover:bg-[#3243cc]'
                                        }`}
                                    >
                                        <span className="bg-white p-0.5 rounded flex items-center justify-center group-hover:rotate-12 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mode === 'vocab' ? '#059669' : '#4255ff'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                        </span>
                                        <span className="text-xs font-black tracking-wide uppercase">Flashcard</span>
                                    </button>
                                </div>
                            </div>

            {/* 3. DANH SÁCH ÔN TẬP (MÀU CAM) */}
     {mode !== 'vocab' && (
            <div className="pt-1">
                <button 
                    onClick={() => {
                        onOpenReviewList();    
                        setIsUtilsOpen(false); 
                    }}
                    className="w-full py-2.5 bg-orange-50 border border-orange-200 text-orange-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-100 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 group shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 group-hover:text-orange-600 transition-colors">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                        <path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path>
                        <path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path>
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wide">LỊCH TRÌNH ÔN TẬP</span>
                </button>
            </div>
)}
        </div>
    )}
</div>
     
                    {/* 3. TÙY CHỈNH */}
                    <div className="relative flex-1" ref={configMenuRef}> 
                    <button onClick={() => toggleMenu('config')} className={`w-full h-full px-1 border rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-[0.98] ${isConfigOpen ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
                        <span className="font-bold text-xs whitespace-nowrap">TÙY CHỈNH</span>
                    </button>
                    
{isConfigOpen && (
<div className="absolute bottom-full right-0 mb-2 z-50 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-200">

   {/* MỤC 1: SỐ CHỮ MẪU (CHỈ HIỆN Ở KANJI) */}
        {mode === 'kanji' && (
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-gray-600">Số chữ mẫu</label>
                    <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-1.5 rounded">{config.traceCount} chữ</span>
                </div>
                <input type="range" min="1" max="12" step="1" className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" value={config.traceCount} onChange={(e) => handleChange('traceCount', parseInt(e.target.value))} />
            </div>
        )}

    {/* MỤC 2: ĐỘ ĐẬM CHỮ */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold text-gray-600">Độ đậm chữ</label>
                                    {/* Đổi màu số % */}
                                    <span className={`text-[11px] font-black px-1.5 rounded ${mode === 'vocab' ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-600 bg-indigo-50'}`}>
                                        {Math.round(config.traceOpacity * 100)}%
                                    </span>
                                </div>
                                {/* Đổi màu thanh trượt (accent) */}
                                <input 
                                    type="range" min="0.05" max="0.3" step="0.05" 
                                    className={`w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer ${mode === 'vocab' ? 'accent-emerald-600' : 'accent-indigo-600'}`} 
                                    value={config.traceOpacity} 
                                    onChange={(e) => handleChange('traceOpacity', parseFloat(e.target.value))} 
                                />
                            </div>

   {/* MỤC 3: CỠ CHỮ */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold text-gray-600">Cỡ chữ</label>
                                    {/* Đổi màu số pt */}
                                    <span className={`text-[11px] font-black px-1.5 rounded ${mode === 'vocab' ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-600 bg-indigo-50'}`}>
                                        {config.fontSize} pt
                                    </span>
                                </div>
                                {/* Đổi màu thanh trượt */}
                                <input 
                                    type="range" min="27" max="37" step="1" 
                                    className={`w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer ${mode === 'vocab' ? 'accent-emerald-600' : 'accent-indigo-600'}`} 
                                    value={config.fontSize} 
                                    onChange={(e) => handleChange('fontSize', parseInt(e.target.value))} 
                                />
                            </div>
{/* MỤC 4: ĐỘ ĐẬM KHUNG */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold text-gray-600">Độ đậm khung</label>
                                    {/* Đổi màu số % */}
                                    <span className={`text-[11px] font-black px-1.5 rounded ${mode === 'vocab' ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-600 bg-indigo-50'}`}>
                                        {Math.round(config.gridOpacity * 100)}%
                                    </span>
                                </div>
                                {/* Đổi màu thanh trượt */}
                                <input 
                                    type="range" min="0.1" max="1" step="0.1" 
                                    className={`w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer ${mode === 'vocab' ? 'accent-emerald-600' : 'accent-indigo-600'}`} 
                                    value={config.gridOpacity} 
                                    onChange={(e) => handleChange('gridOpacity', parseFloat(e.target.value))} 
                                />
                            </div>

{/* MỤC 5: CHẾ ĐỘ HIỂN THỊ (CHỈ HIỆN Ở KANJI) */}
        {mode === 'kanji' && (
            <div className="pt-0"> 
                <div className="space-y-2">
                    {/* Hàng chứa 3 nút Radio */}
                    <div className="flex items-center justify-between px-1">
                        
                        {/* 1. Nét viết */}
                        <label className="flex items-center gap-1.5 cursor-pointer group select-none">
                            <input 
                                type="radio" 
                                name="display_mode" 
                                checked={config.displayMode === 'strokes'}
                                onChange={() => handleChange('displayMode', 'strokes')}
                                className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                            />
                            <span className={`text-[11px] font-bold transition-colors ${config.displayMode === 'strokes' ? 'text-indigo-700' : 'text-gray-500 group-hover:text-indigo-600'}`}>
                                Nét viết
                            </span>
                        </label>

                        {/* 2. On/Kun */}
                        <label className="flex items-center gap-1.5 cursor-pointer group select-none">
                            <input 
                                type="radio" 
                                name="display_mode" 
                                checked={config.displayMode === 'readings'}
                                onChange={() => handleChange('displayMode', 'readings')}
                                className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                            />
                            <span className={`text-[11px] font-bold transition-colors ${config.displayMode === 'readings' ? 'text-indigo-700' : 'text-gray-500 group-hover:text-indigo-600'}`}>
                                On/Kun
                            </span>
                        </label>

                        {/* 3. Từ vựng */}
                        <label className="flex items-center gap-1.5 cursor-pointer group select-none">
                            <input 
                                type="radio" 
                                name="display_mode" 
                                checked={config.displayMode === 'vocab'}
                                onChange={() => handleChange('displayMode', 'vocab')}
                                className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                            />
                            <span className={`text-[11px] font-bold transition-colors ${config.displayMode === 'vocab' ? 'text-indigo-700' : 'text-gray-500 group-hover:text-indigo-600'}`}>
                                Từ vựng
                            </span>
                        </label>

                    </div>
                </div>
            </div>
        )}
{/* NÚT ĐẶT LẠI MẶC ĐỊNH - Đã thu gọn */}
<div className="pt-2 mt-1 border-t border-gray-200"> {/* Giảm padding top từ pt-1 về pt-0 */}
<button 
    onClick={() => onChange({ ...config, fontSize: 30, traceCount: mode === 'vocab' ? 12 : 9, traceOpacity: 0.15, gridOpacity: 0.8, displayMode: 'strokes' })} 
   className="w-full py-1.5 text-[10px] font-bold text-red-500 bg-red-50 md:hover:bg-red-500 md:hover:text-white active:bg-red-500 active:text-white rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95"
>
    {/* Giảm size icon từ 12 xuống 10 */}
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> 
    KHÔI PHỤC MẶC ĐỊNH
</button>
</div>

</div>
)}
                    </div>
                </div>

{/* --- PHẦN CUỐI CỦA SIDEBAR (CẬP NHẬT THÊM NÚT TÀI LIỆU) --- */}
    <div className="w-full mt-auto pt-4 flex flex-col gap-4"> 
    
  {/* 1. NÚT IN (ĐÃ KHÓA) */}
    <button 
        disabled={true} // Vô hiệu hóa chức năng click
        className="w-full py-3.5 text-white text-lg font-bold rounded-xl shadow-none flex items-center justify-center gap-2 transition-all bg-gray-400 cursor-not-allowed opacity-70"
        title="Tính năng đang tạm khóa"
    >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg> 
        IN / LƯU PDF (Đang khóa)
    </button>

{/* --- 2. NÚT XEM TRƯỚC / XEM BẢN MẪU (MÀU: XANH KHI XEM, ĐỎ KHI ĐÓNG) --- */}
{(() => {
// Biến kiểm tra xem có nội dung hay không
const isEmpty = !config.text || config.text.trim().length === 0;

return (
    <button 
        onClick={() => {
            if (showMobilePreview) {
                setShowMobilePreview(false);
            } else {
                setShowMobilePreview(true);
                // Cuộn xuống vùng xem trước
                setTimeout(() => {
                    const previewElement = document.getElementById('preview-area');
                    if(previewElement) previewElement.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }}
        className={`md:hidden w-full py-3 font-bold rounded-xl border shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all mt-3 ${
            showMobilePreview 
                ? 'bg-red-50 text-red-700 border-red-200'      // KHI ĐANG MỞ -> MÀU ĐỎ
                : 'bg-green-50 text-green-700 border-green-200' // KHI ĐANG ĐÓNG -> MÀU XANH
        }`}
    >
        {showMobilePreview ? (
            // === TRẠNG THÁI: ĐANG MỞ (NÚT ĐỂ ĐÓNG LẠI) ===
            <>
                {isEmpty ? (
                    // Đóng bản mẫu: Giữ nguyên icon X
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                ) : (
                    // Đóng bản in: Dùng icon CON MẮT MỞ (Eye)
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}

                {isEmpty ? "ĐÓNG HƯỚNG DẪN" : "ĐÓNG BẢN XEM TRƯỚC"}
            </>
        ) : (
            // === TRẠNG THÁI: ĐANG ĐÓNG (NÚT ĐỂ MỞ RA) ===
            <>
                {isEmpty ? (
                    /* Xem bản mẫu: Giữ nguyên icon Quyển sách */
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        XEM HƯỚNG DẪN
                    </>
                ) : (
                    /* Xem trước bản in: Dùng icon CON MẮT GẠCH CHÉO (Eye Off) */
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        XEM TRƯỚC BẢN IN
                    </>
                )}
            </>
        )}
    </button>
);
})()}

    {/* 2. KHU VỰC LIÊN HỆ (4 NÚT: DONATE - TIKTOK - NHÓM - TÀI LIỆU) */}
    <div className="flex items-center justify-between px-2 gap-2 text-xs font-bold text-gray-500 pb-2">
        
{/* Nút Donate */}
        <div className="relative flex flex-col items-center" ref={cafeModalRef}>
            <button 
                onClick={() => { setIsCafeModalOpen(!isCafeModalOpen); setIsMenuOpen(false); setIsUtilsOpen(false); setIsConfigOpen(false); setIsFilterMenuOpen(false); }} 
                className="flex flex-col items-center gap-1 group w-full"
            >
                {/* Icon Container: Cố định w-9 h-9 để tròn đều */}
                <div className="p-2 bg-orange-50 rounded-full text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                        <line x1="6" y1="2" x2="6" y2="4"/>
                        <line x1="10" y1="2" x2="10" y2="4"/>
                        <line x1="14" y1="2" x2="14" y2="4"/>
                    </svg>
                </div>
                <span className="text-[10px] font-bold text-gray-500 group-hover:text-orange-600">Mời cafe</span>
            </button>

            {/* Popup Cafe */}
            {isCafeModalOpen && (
                <div className="absolute bottom-full left-0 mb-3 z-[60] w-60 bg-white border border-orange-100 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-center space-y-3">
                        <p className="text-[10px] text-orange-800 font-medium leading-tight">Sự ủng hộ của bạn giúp mình duy trì và phát triển nhiều tính năng mới. Cảm ơn bạn rất nhiều!</p>
                        <div className="bg-gray-50 p-2 rounded-lg inline-block shadow-inner">
                            <img src="https://i.ibb.co/JWGwcTL1/3381513652021492183.jpg" alt="QR Cafe" className="w-28 h-auto rounded"/>
                        </div>
                        <p className="text-[11px] text-orange-500 font-bold bg-orange-50 py-1 rounded">MB BANK: 99931082002</p>
                    </div>
                    {/* Mũi tên trỏ xuống của popup */}
                    <div className="absolute top-full left-4 -mt-1 w-3 h-3 bg-white border-b border-r border-orange-100 rotate-45"></div>
                </div>
            )}
        </div>
        {/* Nút Tiktok */}
        <a href="https://www.tiktok.com/@phadaotiengnhat" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 hover:text-black transition-colors group">
            <div className="p-2 bg-gray-100 rounded-full text-gray-600 group-hover:bg-black group-hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
            </div>
            <span className="text-[10px]">Tiktok</span>
        </a>

        {/* Nút Nhóm */}
        <a href="https://zalo.me/g/jeflei549" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 hover:text-blue-600 transition-colors group">
            <div className="p-2 bg-blue-50 rounded-full text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <span className="text-[10px]">Nhóm</span>
        </a>

        {/* --- NÚT MỚI: TÀI LIỆU --- */}
        <button 
            onClick={() => setIsDocsModalOpen(true)}
            className="flex flex-col items-center gap-1 hover:text-purple-600 transition-colors group"
        >
            <div className="p-2 bg-purple-50 rounded-full text-purple-500 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <span className="text-[10px]">Tài liệu</span>
        </button>

    </div>

    </div>

    {/* --- POPUP TÀI LIỆU (MỚI THÊM) --- */}
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

{/* --- MODAL (POPUP) XÁC NHẬN IN --- */}
            {isPrintModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    {/* Hộp nội dung chính */}
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200 border border-gray-200">
                        
                        {/* 1. NÚT ĐÓNG (X) MÀU ĐỎ Ở GÓC PHẢI */}
                        <button 
                            onClick={() => setIsPrintModalOpen(false)}
                            className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full transition-colors z-10 group"
                            title="Đóng"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        {/* 2. NỘI DUNG CẢNH BÁO */}
                        <div className="p-6 flex flex-col items-center text-center">
                        
                            {/* Icon trang trí (Giữ màu vàng cảnh báo) */}
                            <div className="w-14 h-14 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mb-4 border border-yellow-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            </div>

                            <h3 className="text-xl font-bold text-gray-800 mb-2">LƯU Ý QUAN TRỌNG</h3>
                            
                            {/* KHUNG LƯU Ý (ĐỔI MÀU THEO CHẾ ĐỘ) */}
                            <div className={`border rounded-xl p-4 mb-6 text-sm leading-relaxed text-left w-full ${
                                mode === 'vocab' 
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                                : 'bg-blue-50 border-blue-100 text-blue-800'
                            }`}>
                                <p className="font-bold mb-2 flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Để bản in đẹp nhất:
                                </p>
                                <ul className="list-disc list-inside space-y-1.5 ml-1">
                                    <li>Nên dùng <b>Máy tính (PC/Laptop)</b>.</li>
                                    <li>Trình duyệt khuyên dùng: <b>Google Chrome</b>.</li>
                                    <li>Không nên dùng <b>iphone</b>.</li>
                                    <li>
                                        Hoặc có thể tải file tạo sẵn 
                                        <a 
                                            href="https://drive.google.com/drive/folders/1e7J-I6icRWjXla5WGUriUqgFXb7B72cP?usp=sharing" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            // LOGIC ĐẢO NGƯỢC MÀU:
                                            // - Nếu là Vocab (Theme Xanh lá) -> Link màu Xanh dương (Blue)
                                            // - Nếu là Kanji (Theme Xanh dương) -> Link màu Xanh lá (Emerald)
                                            className={`ml-1 font-bold underline transition-colors ${
                                                mode === 'vocab' 
                                                ? 'text-blue-700 hover:text-blue-500' 
                                                : 'text-emerald-700 hover:text-emerald-500'
                                            }`}
                                        >
                                            ở đây
                                        </a>
                                    </li>
                                </ul>
                            </div>

                            {/* 3. NÚT IN THẬT SỰ (ĐỔI MÀU THEO CHẾ ĐỘ) */}
                            <button 
                                onClick={() => {
                                    setIsPrintModalOpen(false); 
                                    onPrint(); 
                                }}
                                className={`w-full py-3.5 text-white text-lg font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                    mode === 'vocab'
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                                TIẾN HÀNH IN/LƯU NGAY
                            </button>

                        </div>
                    </div>
                </div>
            )}

            </div>
        </div>
        
        {/* GIAO DIỆN THANH LOADING (Overlay) */}
        {isLoading && (
           <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="w-72 p-6 bg-white rounded-2xl shadow-2xl border border-indigo-50 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider animate-pulse">
                    Đang nạp dữ liệu...
                </span>
                <span className="text-sm font-black text-indigo-600">{progress}%</span>
                </div>
                
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                    style={{ width: `${progress}%` }}
                ></div>
                </div>
                
                <p className="text-[10px] text-gray-400 mt-3 text-center italic">
                Hệ thống đang xử lý, vui lòng đợi giây lát...
                </p>
            </div>
            </div>
        )}
        {/* 4. NÚT CHUYỂN CHẾ ĐỘ */}
<div className="fixed bottom-6 right-6 z-[60] no-print print:hidden">
    <button
        onClick={() => {
         
            const newMode = mode === 'kanji' ? 'vocab' : 'kanji';
            setPracticeMode(newMode);
            
            if (newMode === 'vocab') {
                setFilterOptions({
                    hiragana: true,
                    katakana: true,
                    kanji: true,
                    removeDuplicates: false
                });
            }
          
            onChange(prev => ({ 
                ...prev, 
                text: '', 
               
                traceCount: newMode === 'vocab' ? 12 : 9 
            })); 
        }}
        className={`h-12 pl-4 pr-6 rounded-full font-black text-[11px] uppercase tracking-widest shadow-2xl border-2 transition-all active:scale-95 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
        
            mode === 'kanji' 
            ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700 shadow-indigo-200' 
            : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 shadow-emerald-200'
        }`}
    >
   
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">
            
                {mode === 'kanji' ? '字' : '語'}
        </div>
        
        <div className="flex flex-col items-start leading-none gap-0.5">
            <span className="opacity-70 text-[9px]">Chế độ</span>
         
            <span>{mode === 'kanji' ? 'KANJI' : 'TỪ VỰNG'}</span>
        </div>
    </button>
</div>
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
// --- COMPONENT: BẢNG DANH SÁCH XEM TRƯỚC VÀ CHỈNH SỬA (MONOCHROME) ---
const PreviewListModal = ({ isOpen, onClose, onStart, text, mode, dbData, targetAction, customVocabData, onSaveVocab }) => {
    const [editingWord, setEditingWord] = useState(null);
    const [editForm, setEditForm] = useState({ reading: '', meaning: '', hanviet: '' });

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
        // Lấy từ ORIGINAL_TUVUNG_DB (nếu đã từng sửa) hoặc TUVUNG_DB (nếu chưa sửa bao giờ)
        const originalInfo = dbData?.ORIGINAL_TUVUNG_DB?.[word] || dbData?.TUVUNG_DB?.[word] || { reading: '', meaning: '' };
        
        // Trả Hán việt về trạng thái tự động ghép chữ
        const originalHanviet = word.split('').map(c => dbData?.KANJI_DB?.[c]?.sound || '').filter(s => s).join(' ');
        
        setEditForm({ 
            reading: originalInfo.reading || '', 
            meaning: originalInfo.meaning || '', 
            hanviet: originalHanviet 
        });
    };

    return (
        <div className="fixed inset-0 z-[400] flex justify-center items-center bg-gray-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-gray-200">
                
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
                                        <div key={i} className="flex flex-col items-center justify-center border border-gray-200 rounded-xl p-2 w-16 h-20 bg-gray-50 hover:border-gray-900 transition-colors group">
                                            <span className="text-3xl font-['Klee_One'] text-gray-900 leading-none">{char}</span>
                                            <span className="text-[9px] font-bold text-gray-500 mt-1 truncate w-full text-center group-hover:text-gray-900">{info.sound || '---'}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
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
                                                        <button 
                                                            onClick={() => startEdit(item)} 
                                                            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ml-2 cursor-pointer z-10 block"
                                                        >
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
                        BẮT ĐẦU HỌC NGAY
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- COMPONENT: KANJI MỖI NGÀY (10 CHỮ THỦ CÔNG - CHỮ ĐEN TO - LOOP VÔ TẬN) ---
const KanjiOfTheDay = () => {
    // 1. DANH SÁCH 10 KANJI (Bạn có thể tự do sửa chữ, âm Hán và ý nghĩa ở đây)
    const KANJI_LIST = React.useMemo(() => [
        { char: '禅', sound: 'THIỀN', meaning: 'Thiền định, tĩnh tâm.' },
        { char: '道', sound: 'ĐẠO', meaning: 'Con đường, đạo lý.' },
        { char: '心', sound: 'TÂM', meaning: 'Trái tim, tâm hồn.' },
        { char: '夢', sound: 'MỘNG', meaning: 'Giấc mơ, hoài bão.' },
        { char: '愛', sound: 'ÁI', meaning: 'Tình cảm, yêu thương.' },
        { char: '静', sound: 'TĨNH', meaning: 'Yên lặng, thanh tĩnh.' },
        { char: '志', sound: 'CHÍ', meaning: 'Ý chí, quyết tâm.' },
        { char: '悟', sound: 'NGỘ', meaning: 'Giác ngộ, thức tỉnh' },
        { char: '学', sound: 'KHÔNG', meaning: 'Học hành, học tập.' },
        { char: '忍', sound: 'NHẪN', meaning: 'Nhẫn nại, kiên tâm.' }
    ], []);

    // 2. STATE LƯU TRỮ
    const [currentKanji, setCurrentKanji] = useState(KANJI_LIST[0]); // Mặc định hiển thị chữ đầu tiên
    const [replayKey, setReplayKey] = useState(0);

    // 3. CHỌN NGẪU NHIÊN 1 TỪ KHI LOAD TRANG
    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * KANJI_LIST.length);
        setCurrentKanji(KANJI_LIST[randomIndex]);
    }, [KANJI_LIST]);

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
        <div className="hidden lg:flex w-full max-w-[400px] mx-auto ml-auto aspect-square bg-[#f8f8f9] rounded-3xl border border-zinc-200 shadow-sm flex-col p-7 transition-transform hover:-translate-y-1 duration-300">
            
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

// --- COMPONENT: TRANG CHỦ CHUYÊN NGHIỆP (Theo chuẩn HTML gốc) ---
const LandingPage = ({ srsData, onOpenReviewList, onOpenSetup, dbData }) => {
    const featuresRef = useRef(null);

    // Tính badge màu cam
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

    return (
        <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white relative">
            
            {/* NAVBAR */}
            <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                            <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white font-bold font-jp">学</div>
                            <span className="text-xl font-bold tracking-tight">PHÁ ĐẢO<span className="font-light"> TIẾNG NHẬT</span></span>
                        </div>
                        
                        <div className="hidden md:flex items-center gap-8">
            
                
                            <a href="https://drive.google.com/drive/folders/19JT79eX8-xn6jweibSj8vzxnugJwjI4C" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer">Tài liệu</a>
                            <div className="h-4 w-px bg-zinc-200"></div>
                            <a href="https://zalo.me/g/jeflei549" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors">
                                <span>Tham gia Nhóm</span>
                            </a>
                        </div>
                        
                        <button className="md:hidden p-2 text-zinc-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu w-6 h-6"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path></svg>
                        </button>
                    </div>
                </div>
            </nav>

          {/* HERO SECTION */}
            <section className="pt-28 pb-16 px-6 lg:px-8 max-w-7xl mx-auto min-h-[90vh] flex items-center">
                <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
                    
                    {/* KHỐI TEXT BÊN TRÁI */}
                    <div style={{ opacity: 1, transform: 'none' }} className="animate-in slide-in-from-left-8 duration-700">
                        <div className="inline-block px-3 py-1 mb-5 border border-zinc-200 rounded-full bg-zinc-50">
                            <span className="text-[10px] font-bold text-zinc-600 tracking-wider uppercase">Bắt đầu hành trình của bạn</span>
                        </div>
                        
                        {/* Font chữ đã được thu nhỏ lại vừa vặn hơn */}
                        <h1 className="text-3xl md:text-[4rem] font-bold tracking-tight leading-[1.05] mb-6 text-zinc-900">
                            Nơi nào có ý chí <br />
                            <span className="text-zinc-400 font-light italic font-serif">nơi đó có con đường</span>
                        </h1>
                        
                        <p className="text-lg text-zinc-500 mb-8 max-w-md font-medium leading-relaxed">
                            <span className="font-jp">日本語を勉強しましょう。</span>
                        </p>
                        
                        <div className="flex flex-wrap gap-3">
                            <button onClick={scrollToFeatures} className="px-7 py-3.5 bg-zinc-900 text-white rounded-full text-sm font-bold hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group">
                                Bắt đầu học
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><path d="m9 18 6-6-6-6"></path></svg>
                            </button>
                        </div>
                    </div>

                    {/* KHỐI KANJI BÊN PHẢI ĐÃ LÀM Ở BƯỚC 1 */}
                    <KanjiOfTheDay dbData={dbData} />

                </div>
            </section>
            {/* FEATURES SECTION (3 THẺ CỦA BẠN) */}
            <section ref={featuresRef} className="py-20 bg-zinc-50/50 border-t border-zinc-100 min-h-screen flex flex-col justify-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight mb-4">Mọi thứ bạn cần</h2>
                        <p className="text-zinc-500 max-w-2xl mx-auto text-lg">Phương pháp học Flashcard, lặp lại ngắt quãng, và nhiều thứ khác...</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                       

                        {/* Thẻ 1 */}
                        <div onClick={() => onOpenSetup('game')} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1" style={{ opacity: 1, transform: 'none' }}>
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-brain w-6 h-6"><path d="M12 18V5"></path><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"></path><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"></path><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"></path><path d="M18 18a4 4 0 0 0 2-7.464"></path><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"></path><path d="M6 18a4 4 0 0 1-2-7.464"></path><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1">CHẾ ĐỘ HỌC</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Kanji & từ vựng</p>
                            <p className="text-zinc-500 leading-relaxed">Câu hỏi trắc nghiệm và ghép thẻ.</p>
                        </div>
                       {/* Thẻ 2 */}
                        <div onClick={() => onOpenSetup('flashcard')} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1" style={{ opacity: 1, transform: 'none' }}>
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open w-6 h-6"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1">FLASHCARD</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Kanji & từ vựng</p>
                            <p className="text-zinc-500 leading-relaxed">Tích hợp lặp lại ngắt quãng thông minh.</p>
                        </div>

                        {/* Thẻ 3 */}
                        <div onClick={onOpenReviewList} className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 relative overflow-hidden" style={{ opacity: 1, transform: 'none' }}>
                            {dueCharsCount > 0 && (
                                <div className="absolute top-6 right-6 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full animate-pulse uppercase tracking-wider">
                                    Cần ôn {dueCharsCount} thẻ
                                </div>
                            )}
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar w-6 h-6"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-1">LỊCH TRÌNH HỌC</h3>
                            <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">Giữ vững tiến độ</p>
                            <p className="text-zinc-500 leading-relaxed">Lịch trình cá nhân hóa phù hợp với tốc độ của bạn.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-white border-t border-zinc-100 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-zinc-900 rounded-full flex items-center justify-center text-white text-xs font-bold font-jp">学</div>
                        <span className="font-bold tracking-tight">Phá Đảo Tiếng Nhật</span>
                    </div>
                    <p className="text-sm text-zinc-500">© 2026 Phá Đảo Tiếng Nhật.</p>
                </div>
            </footer>
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

// --- COMPONENT: THƯ VIỆN CHỌN NHANH (100% ĐEN - TRẮNG - XÁM) ---
const LibraryModal = ({ isOpen, onClose, mode, dbData, srsData, onSelectData }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const [randomCount, setRandomCount] = useState(10);
    const [minnaLesson, setMinnaLesson] = useState('');
    const [mimiPart, setMimiPart] = useState('');
    const [mimiLevel, setMimiLevel] = useState('N3');
    const [tangoPart, setTangoPart] = useState('');
    const [tangoLevel, setTangoLevel] = useState('N3');

    if (!isOpen) return null;

    // --- HÀM TẢI DỮ LIỆU CHUNG ---
    const fetchAndSetData = async (url) => {
        setIsLoading(true); setProgress(20);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Lỗi");
            const isJsonArray = url.includes('minna') || url.includes('mimi') || url.includes('tango');
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
                onSelectData(resultText); // Trả dữ liệu về cho component cha
                setIsLoading(false); 
                onClose(); // Đóng modal
            }, 400);
        } catch (error) { 
            alert("Lỗi tải dữ liệu!"); 
            setIsLoading(false); 
        }
    };

    // --- HÀM TẢI RANDOM KANJI ---
    const loadRandomKanji = async (level) => {
        if (!randomCount || randomCount <= 0) return alert("Vui lòng nhập số lượng!");
        setIsLoading(true); setProgress(20);
        try {
            const response = await fetch(`./data/kanji${level.toLowerCase()}.json`);
            const rawText = await response.text();
            const cleanText = rawText.replace(/["\n\r\s]/g, '');
            const allChars = Array.from(cleanText);
            const unstudiedChars = allChars.filter(char => !srsData[char]);
            const studiedChars = allChars.filter(char => srsData[char]);
            
            let count = randomCount > 50 ? 50 : randomCount;
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

    // --- HÀM TẢI TỪ VỰNG THÔNG MINH ---
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
            
            {/* LOADING OVERLAY BÊN TRONG MODAL */}
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
                        {mode === 'kanji' ? '📚 THƯ VIỆN KANJI' : '📚 THƯ VIỆN TỪ VỰNG'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">✕</button>
                </div>
                
                <div className="p-6 space-y-6">
                    {mode === 'kanji' ? (
                        <>
                            {/* Lấy ngẫu nhiên */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Lấy ngẫu nhiên</label>
                                <div className="flex gap-3 items-center mb-4">
                                    <input type="number" min="1" max="50" value={randomCount} onChange={e => setRandomCount(e.target.value)} className="w-20 p-2.5 text-center border border-gray-300 rounded-lg font-bold text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all" />
                                    <span className="text-xs font-bold text-gray-500">chữ mới chưa học</span>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {['N5', 'N4', 'N3', 'N2', 'N1'].map(lvl => (
                                        <button key={lvl} onClick={() => loadRandomKanji(lvl)} className="py-2.5 border border-gray-200 bg-white text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white rounded-xl font-bold text-xs transition-all active:scale-95">{lvl}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Bộ thủ & Bảng chữ cái */}
                            <div className="border-t border-gray-100 pt-5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Bộ thủ & Bảng chữ cái</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => fetchAndSetData('./data/bothu.json')} className="py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-all active:scale-95">Bộ thủ</button>
                                    <button onClick={() => fetchAndSetData('./data/hiragana.json')} className="py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-all active:scale-95">Hiragana</button>
                                    <button onClick={() => fetchAndSetData('./data/katakana.json')} className="py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-all active:scale-95">Katakana</button>
                                </div>
                            </div>
                            
                            {/* Lấy toàn bộ Kanji */}
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

                            {/* Mimi */}
                            <div className="flex items-center justify-between group hover:bg-gray-50 p-2 rounded-xl transition-colors border border-transparent hover:border-gray-200">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Mimikara</label>
                                <div className="flex items-center gap-2">
                                    <select value={mimiLevel} onChange={e => setMimiLevel(e.target.value)} className="p-1 border border-gray-200 rounded text-xs font-bold text-gray-700 outline-none bg-white">
                                        <option value="N3">N3</option><option value="N2">N2</option><option value="N1">N1</option>
                                    </select>
                                    <span className="text-gray-400 font-bold text-[10px] uppercase">Phần</span>
                                    <input 
                                        type="number" 
                                        placeholder="..." 
                                        value={mimiPart} 
                                        onChange={e => { setMimiPart(e.target.value); if(e.target.value) {setMinnaLesson(''); setTangoPart('');} }} 
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
                                    <select value={tangoLevel} onChange={e => setTangoLevel(e.target.value)} className="p-1 border border-gray-200 rounded text-xs font-bold text-gray-700 outline-none bg-white">
                                        <option value="N3">N3</option><option value="N2">N2</option><option value="N1">N1</option>
                                    </select>
                                    <span className="text-gray-400 font-bold text-[10px] uppercase">Phần</span>
                                    <input 
                                        type="number" 
                                        placeholder="..." 
                                        value={tangoPart} 
                                        onChange={e => { setTangoPart(e.target.value); if(e.target.value) {setMinnaLesson(''); setMimiPart('');} }} 
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
    config, onChange, mode, setPracticeMode, dbData, srsData 
}) => {
    const [localText, setLocalText] = useState(config.text);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false); // Quản lý mở Thư viện

    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterRef = useRef(null);
    const isComposing = useRef(false);

    const [filterOptions, setFilterOptions] = useState({
        hiragana: true, katakana: true, kanji: true, removeDuplicates: false 
    });

    useEffect(() => {
        if (isOpen) {
            setLocalText(config.text);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            setIsFilterMenuOpen(false); 
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen, config.text]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (filterRef.current && !filterRef.current.contains(event.target)) setIsFilterMenuOpen(false);
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
        if (mode === 'vocab') return "Nhập thủ công TỪ VỰNG\n(từ vựng phân cách bằng dấu xuống dòng)";
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
                   <div className="flex bg-gray-200/50 p-1 rounded-xl border border-gray-200">
        <button onClick={() => setPracticeMode('kanji')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'kanji' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}>KANJI</button>
        <button onClick={() => setPracticeMode('vocab')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'vocab' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}>TỪ VỰNG</button>
    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm">✕</button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-5 relative">
                    
                    {/* Thanh tìm kiếm */}
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

                    {/* Textarea Nhập liệu */}
                    <div className="relative">
                        <textarea 
                            value={localText} onChange={handleInputText} onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd} onBlur={handleBlurText}
                            placeholder={getDynamicPlaceholder()} 
                            className="w-full h-[120px] p-4 bg-gray-50 border border-gray-200 rounded-2xl resize-none text-[18px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:bg-white transition-all custom-scrollbar leading-relaxed" 
                            style={{ fontFamily: "system-ui, -apple-system, sans-serif, 'Klee One'" }}
                        />
                        {localText && (
                            <button onClick={() => { setLocalText(''); onChange({ ...config, text: '' }); }} className="absolute bottom-4 right-4 text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm transition-colors">Xóa hết</button>
                        )}
                    </div>

                    {/* Tiện ích (Thư viện, Xáo trộn, BỘ LỌC) */}
    <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setIsLibraryOpen(true)} className="flex items-center justify-center py-4 rounded-2xl bg-white border border-gray-200 hover:border-gray-900 hover:shadow-md text-gray-700 transition-all group">
            <span className="text-[10px] font-bold uppercase tracking-widest">Thư viện</span>
        </button>
        
        <button onClick={handleShuffle} className="flex items-center justify-center py-4 rounded-2xl bg-white border border-gray-200 hover:border-gray-900 hover:shadow-md text-gray-700 transition-all group">
            <span className="text-[10px] font-bold uppercase tracking-widest">Xáo trộn</span>
        </button>
        
        <div className="relative" ref={filterRef}>
            <button disabled={mode === 'vocab'} onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)} className={`w-full flex items-center justify-center py-4 rounded-2xl border transition-all group ${mode === 'vocab' ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-70' : isFilterMenuOpen ? 'bg-gray-100 border-gray-900 text-gray-900' : 'bg-white border-gray-200 hover:border-gray-900 hover:shadow-md text-gray-700'}`}>
                <span className="text-[10px] font-bold uppercase tracking-widest">Bộ lọc</span>
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
                            } else { finalContent = getUniqueChars(finalContent); }

                            const cleanLatinh = finalContent.replace(/[a-zA-Z]/g, '');
                            setLocalText(finalContent); onChange({ ...config, text: cleanLatinh });

                            if (!cleanLatinh || cleanLatinh.trim().length === 0) return alert("Bạn chưa nhập dữ liệu để học!");
                            
                            // ĐÓNG TẠM BẢNG SETUP, BÁO LÊN APP ĐỂ MỞ PREVIEW LIST
                            onStart('preview'); 
                        }}
                        className="w-full py-4 bg-gray-900 hover:bg-black text-white font-black rounded-2xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-widest flex justify-center items-center gap-2"
                    >
                        TIẾP TỤC
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
const App = () => {
    // --- STATE QUẢN LÝ ỨNG DỤNG ---
    const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
    const [isLearnGameOpen, setIsLearnGameOpen] = useState(false);
    const [isReviewListOpen, setIsReviewListOpen] = useState(false);
    const [isPreviewListOpen, setIsPreviewListOpen] = useState(false);
    
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

   // --- HÀM KHỞI ĐỘNG HỌC (ĐÃ FIX LỖI NHÁY MÀN HÌNH) ---
    const handleStartLearning = (target) => {
        if (target === 'preview') {
            // Mở bảng danh sách xem trước ngay lập tức
            setSetupConfig(prev => ({ ...prev, isOpen: false }));
            setIsPreviewListOpen(true); 
        } else {
            // Mở thẳng flashcard hoặc game ngay lập tức
            setSetupConfig({ isOpen: false, targetAction: null });
            setIsPreviewListOpen(false);
            
            if (target === 'flashcard') setIsFlashcardOpen(true);
            if (target === 'game') setIsLearnGameOpen(true);
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
                onOpenSetup={(target) => setSetupConfig({ isOpen: true, targetAction: target })}
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
            />
{/* MODAL: DANH SÁCH XEM TRƯỚC TỪ VỰNG & KANJI */}
            <PreviewListModal
                isOpen={isPreviewListOpen}
                onClose={() => {
                    // Khi bấm Quay Lại, đóng Preview và mở lại Setup ngay lập tức
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

            <ReviewListModal 
                isOpen={isReviewListOpen}
                onClose={() => setIsReviewListOpen(false)}
                srsData={srsData}
                dbData={dbData}
                onResetSRS={handleResetAllSRS}
                onLoadChars={(chars) => {
                    setConfig({ ...config, text: chars }); 
                    setIsReviewListOpen(false); 
                    // Tự động mở Setup bảng Flashcard khi click ôn tập từ danh sách
                    setSetupConfig({ isOpen: true, targetAction: 'flashcard' });
                }}
            />

        </div>
    );
};
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
