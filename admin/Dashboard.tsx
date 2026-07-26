import React, { useState } from 'react';
import {
  BarChart3, Users, Wallet, Wrench,
  Home, Settings, LogOut, Menu, X,
  Zap, Radio, Smartphone, Eye
} from 'lucide-react';

interface DashboardProps {
  userName?: string;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  userName = 'Архитектор',
  onNavigate = () => {},
  onLogout = () => {}
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Дашборд', icon: Home },
    { id: 'orders', label: 'Заказы', icon: Wrench },
    { id: 'clients', label: 'Клиенты', icon: Users },
    { id: 'finance', label: 'Финансы', icon: Wallet },
    { id: 'traffic', label: 'Трафик', icon: Radio },
    { id: 'mobile', label: 'Мобильное', icon: Smartphone },
    { id: 'crown', label: 'Корона', icon: Eye },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  const stats = [
    { label: 'Заказы', value: '0', icon: Wrench, color: 'text-blue-400' },
    { label: 'Клиенты', value: '0', icon: Users, color: 'text-green-400' },
    { label: 'Баланс', value: '0 ₽', icon: Wallet, color: 'text-yellow-400' },
    { label: 'Прибыль', value: '0 ₽', icon: BarChart3, color: 'text-purple-400' },
  ];

  const handleNavigate = (page: string) => {
    setActivePage(page);
    onNavigate(page);
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-900 border-r border-gray-800
        transition-transform duration-200 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">KVP Admin</h2>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`
                flex items-center w-full px-3 py-2 rounded-md text-sm transition
                ${activePage === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
              `}
            >
              <item.icon size={18} className="mr-3" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <button
            onClick={onLogout}
            className="flex items-center w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 rounded-md hover:bg-gray-800"
          >
            <LogOut size={18} className="mr-3" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4 text-gray-400 hover:text-white">
              <Menu size={24} />
            </button>
            <h1 className="text-3xl font-bold text-white">
              С возвращением, {userName}
            </h1>
            <p className="mt-2 text-gray-400">KVP Admin Dashboard v0.2</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Zap size={16} className="text-yellow-400" />
            <span>Все системы активны</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-gray-800 bg-gray-900 p-6 transition hover:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold text-white">Последние заказы</h2>
          <p className="mt-4 text-gray-500">Пока нет заказов. Но все 7 Параллелей готовы.</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['kernel', 'admin', 'agent', 'traffic', 'bridges', 'mobile', 'crown'].map((p) => (
              <div key={p} className="px-3 py-2 bg-gray-800 rounded-md text-xs text-gray-300 text-center">
                /{p}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-700">
          KVP Protocol v0.2 · 7 Parallels Active · Маяк: netcity888netcity@gmail.com
        </p>
      </main>
    </div>
  );
};

export default Dashboard;
