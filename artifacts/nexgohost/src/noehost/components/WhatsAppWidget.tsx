import React from 'react';
import { MessageCircle } from 'lucide-react';

const WhatsAppWidget: React.FC = () => {
  return (
    <a 
      href="https://wa.me/1234567890" 
      target="_blank" 
      rel="noopener noreferrer"
      className="fixed bottom-8 right-8 w-16 h-16 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all z-[100] group"
    >
      <MessageCircle size={32} />
      <span className="absolute right-full mr-4 bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-100">
        Chat with us!
      </span>
    </a>
  );
};

export default WhatsAppWidget;
