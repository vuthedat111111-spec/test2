import { motion } from 'motion/react';
import { BookOpen, Brain, Calendar, ChevronRight, Menu, Search, User } from 'lucide-react';
import { useState } from 'react';

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white font-bold font-jp">
                日
              </div>
              <span className="text-xl font-bold tracking-tight">Nihongo<span className="font-light">Zen</span></span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">Bài học</a>
              <a href="#" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">Ngữ pháp</a>
              <a href="#" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">Tài nguyên</a>
              <div className="h-4 w-px bg-zinc-200"></div>
              <button className="p-2 text-zinc-600 hover:text-zinc-900 transition-colors">
                <Search className="w-5 h-5" />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors">
                <span>Đăng nhập</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 text-zinc-600"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-zinc-100 bg-white absolute w-full"
          >
            <div className="px-4 py-4 space-y-4">
              <a href="#" className="block text-sm font-medium text-zinc-600">Bài học</a>
              <a href="#" className="block text-sm font-medium text-zinc-600">Ngữ pháp</a>
              <a href="#" className="block text-sm font-medium text-zinc-600">Tài nguyên</a>
              <div className="pt-4 border-t border-zinc-100">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium">
                  Đăng nhập
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block px-3 py-1 mb-6 border border-zinc-200 rounded-full bg-zinc-50">
              <span className="text-xs font-medium text-zinc-600 tracking-wide uppercase">Bắt đầu hành trình của bạn</span>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Chinh phục tiếng Nhật, <br />
              <span className="text-zinc-400 font-light italic font-serif">Từng ngày một.</span>
            </h1>
            <p className="text-xl text-zinc-500 mb-8 max-w-lg font-jp">
              日本語を学びましょう。Công cụ đơn giản, hiệu quả giúp bạn đọc, viết và nói tự tin.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="px-8 py-4 bg-zinc-900 text-white rounded-full font-medium hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group">
                Bắt đầu học
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="px-8 py-4 bg-white border border-zinc-200 text-zinc-900 rounded-full font-medium hover:bg-zinc-50 transition-colors">
                Xem lộ trình
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="aspect-square rounded-2xl bg-zinc-100 overflow-hidden relative">
               <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[20rem] font-bold text-zinc-200 font-jp select-none">禅</span>
               </div>
               <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur p-6 rounded-xl border border-zinc-100 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Từ vựng mỗi ngày</p>
                      <h3 className="text-2xl font-bold mt-1 font-jp">禅 (Zen)</h3>
                    </div>
                    <button className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                      <BookOpen className="w-5 h-5 text-zinc-400" />
                    </button>
                  </div>
                  <p className="text-zinc-600 text-sm">Thiền định; tĩnh tâm; suy ngẫm.</p>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-zinc-50/50 border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Mọi thứ bạn cần</h2>
            <p className="text-zinc-500 max-w-2xl mx-auto">
              Phương pháp học ngôn ngữ toàn diện, kết hợp lặp lại ngắt quãng, chủ động gợi nhớ và lộ trình bài bản.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: Flashcards */}
            <FeatureCard 
              icon={<BookOpen className="w-6 h-6" />}
              title="Thẻ học từ vựng"
              subtitle="Từ vựng & Kanji"
              description="Nắm vững hàng ngàn từ vựng với hệ thống lặp lại ngắt quãng thông minh."
              delay={0.1}
            />

            {/* Card 2: Quiz */}
            <FeatureCard 
              icon={<Brain className="w-6 h-6" />}
              title="Làm bài tập"
              subtitle="Kiểm tra kiến thức"
              description="Các bài trắc nghiệm tương tác để củng cố ngữ pháp và kỹ năng nghe."
              delay={0.2}
            />

            {/* Card 3: Schedule */}
            <FeatureCard 
              icon={<Calendar className="w-6 h-6" />}
              title="Lịch trình học"
              subtitle="Giữ vững tiến độ"
              description="Lịch trình cá nhân hóa phù hợp với tốc độ và mục tiêu của bạn."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded-full flex items-center justify-center text-white text-xs font-bold font-jp">
              日
            </div>
            <span className="font-bold tracking-tight">NihongoZen</span>
          </div>
          <p className="text-sm text-zinc-500">© 2024 Nihongo Zen. Bảo lưu mọi quyền.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, subtitle, description, delay }: { icon: React.ReactNode, title: string, subtitle: string, description: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5 }}
      className="group bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
    >
      <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-1">{title}</h3>
      <p className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wide">{subtitle}</p>
      <p className="text-zinc-500 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
