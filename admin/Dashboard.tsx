import React from 'react';
import { BarChart3, Users, Wallet, Wrench } from 'lucide-react';

interface DashboardProps {
  userName?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ userName = 'Архитектор' }) => {
  const stats = [
    { label: 'Заказы', value: '0', icon: Wrench, color: 'text-blue-400' },
    { label: 'Клиенты', value: '0', icon: Users, color: 'text-green-400' },
    { label: 'Баланс', value: '0 ₽', icon: Wallet, color: 'text-yellow-400' },
    { label: 'Прибыль', value: '0 ₽', icon: BarChart3, color: 'text-purple-400' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          С возвращением, {userName}
        </h1>
        <p className="mt-2 text-gray-400">KVP Admin Dashboard v0.1</p>
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
        <p className="mt-4 text-gray-500">Пока нет заказов. Но скоро они появятся.</p>
      </div>

      <p className="mt-8 text-center text-xs text-gray-700">
        KVP Protocol v0.1 · Sacred Architecture · Маяк: netcity888netcity@gmail.com
      </p>
    </div>
  );
};

export default Dashboard;
