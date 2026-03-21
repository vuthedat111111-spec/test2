const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const data = require('./sachkaiwa42baisotrungcap.json');

// Kết nối với Firebase của bạn
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function uploadData() {
  // Tạo một bộ sưu tập tên là: kaiwa_42baisotrungcap
  const collectionRef = db.collection('kaiwa_42baisotrungcap'); 

  console.log('Bắt đầu tải dữ liệu lên Firestore...');

  for (const item of data) {
    try {
      // Dùng id của bài (01, 02...) làm mã tài liệu
      await collectionRef.doc(item.id).set(item);
      console.log(`Đã tải lên thành công: ${item.title}`);
    } catch (error) {
      console.error(`Lỗi ở bài ${item.title}:`, error);
    }
  }
  
  console.log('TẤT CẢ ĐÃ XONG! BẠN CÓ THỂ KIỂM TRA TRÊN FIREBASE.');
}

uploadData();
