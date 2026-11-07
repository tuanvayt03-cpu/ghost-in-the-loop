(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('i18n-vi');if(!RT)return;
const STATES=Object.freeze({
  RUNNING:'Đang chạy',PAUSED:'Đã tạm dừng',IDLE:'Đang nghỉ',
  COMPLETE:'Đã hoàn thành',PROTOCOL_WAIT:'Chờ đồng bộ giao thức',
  ERROR:'Có lỗi',BUSY:'Đang xử lý',WAITING:'Đang chờ',
  HUMAN_REQUIRED:'Cần người dùng xử lý',MODEL_RELAY:'Cần chuyển mô hình',
  CONTEXT_BOUNDARY:'Đã chạm giới hạn hội thoại',AUTH_ERROR:'Cần xác thực',
  RECOVERY_EXHAUSTED:'Đã hết lượt khôi phục',
  HARD_GATE:'Chốt an toàn',SOFT_RECOVERY:'Khôi phục nhẹ',
  STALL_WARNING:'Cảnh báo có thể bị treo',RATE_LIMIT:'Bị giới hạn tần suất',
  CORE_BLOCKED:'Lõi Ghost bị chặn',UNCERTAIN_RESOLVED:'Đã xác minh kết quả',
  GATE_RESUMED:'Đã tiếp tục',COMPLETE:'Đã hoàn thành',
  GENERAL:'Thông báo',ALERT:'Cảnh báo',AUTH:'Xác thực',
  RELAY:'Chuyển mô hình',CONTEXT:'Giới hạn hội thoại',RECOVERY:'Khôi phục',
  BLOCKED:'Đã bị chặn',SEND_TIMEOUT:'Gửi quá thời gian',
  STREAM_RESUME_UNAVAILABLE:'Không thể nối lại luồng phản hồi'
});
const EXACT=Object.freeze({
  'Play':'Chạy','Stop':'Dừng Ghost','Page':'Tải lại trang','Export':'Xuất dữ liệu',
  'Copy MD':'Sao chép Markdown','Save MD':'Lưu Markdown','Save JSON':'Lưu JSON',
  'Copy diagnostic report':'Sao chép báo cáo chẩn đoán','round':'lượt',
  'runtime':'bộ máy chạy','resources':'tài nguyên','Resume':'Tiếp tục',
  'watchdog':'bộ theo dõi','Watchdog':'Bộ theo dõi',
  'Ghost+ watchdog':'Ghost+ · Bộ theo dõi',
  'Ghost+ watchdog error':'Ghost+ · Lỗi bộ theo dõi',
  'Ghost+ continuity error':'Ghost+ · Lỗi duy trì tác vụ',
  'Ghost+ web supervisor':'Ghost+ · Giám sát kết nối',
  'Ghost+ web recovery':'Ghost+ · Khôi phục kết nối',
  'Ghost+ adopted active turn':'Ghost+ đã nhận lượt đang xử lý',
  'Ghost+ resumed with confirmed receipt':'Ghost+ đã tiếp tục sau khi xác nhận gửi',
  'Ghost+ verified gate reconciliation':'Ghost+ đã xác minh và mở chốt',
  'Ghost+ cleared legacy operational gate':'Ghost+ đã xóa chốt vận hành cũ',
  'Ghost+ cleared v0.15.13 false triage gate':'Ghost+ đã xóa chốt phân loại sai phiên bản cũ',
  'Ghost+ uncertain resolved':'Ghost+ đã xác minh kết quả chưa chắc chắn',
  'Ghost complete':'Ghost đã hoàn thành',
  'Core only: final control line → one Send → repeat. No automatic resend after an uncertain Send.':
     'Cơ chế lõi: nhận dấu điều khiển cuối → gửi một lần → tiếp tục. Không tự gửi lại khi kết quả chưa được xác minh.',
  'Optional protocols stay external. Ghost points the AI to their canonical source; Play transport does not change.':
     'Các giao thức tùy chọn dùng nguồn chuẩn riêng. Ghost hướng AI tới đúng nguồn; cách gửi không thay đổi.',
  'API-first where supported; DOM fallback is explicitly marked partial.':
     'Ưu tiên API khi có hỗ trợ; nếu đọc từ trang, dữ liệu sẽ được ghi rõ là chưa đầy đủ.',
  'Stopped':'Đã dừng Ghost','Starting...':'Đang khởi động...',
  'Model working...':'ChatGPT đang xử lý...',
  'Waiting for assistant output...':'Đang chờ ChatGPT phản hồi...',
  'Waiting for the next answer...':'Đang chờ phản hồi tiếp theo...',
  'Output changed · waiting for stability':'Phản hồi đang thay đổi · chờ ổn định',
  'Output quiet · waiting for terminal':'Phản hồi đã ổn định · chờ dấu kết thúc lượt',
  'Terminal missing · regrounding':'Thiếu dấu kết thúc lượt · đang đồng bộ lại',
  'Protocol marker missing after bounded recovery · waiting for a new user turn (no automatic Send)':
     'Thiếu dấu kết thúc sau khi khôi phục có giới hạn · chờ người dùng gửi lượt mới (không tự gửi)',
  'Adopted manual user turn after protocol wait · monitoring without Send':
     'Đã nhận lượt do người dùng gửi sau khi chờ giao thức · chỉ theo dõi, không gửi thêm',
  'Prior Send outcome remains unverified after reload; no replay or automatic recovery Send.':
     'Sau khi tải lại, kết quả gửi trước vẫn chưa xác minh · không gửi lại hoặc tự khôi phục',
  'Prior Send is uncertain. Inspect the chat or use Page Reload before resuming.':
     'Kết quả gửi trước chưa rõ. Kiểm tra cuộc chat hoặc tải lại trang trước khi tiếp tục.',
  'Current chat composer was not found.':'Không tìm thấy ô nhập của cuộc trò chuyện hiện tại.',
  'Existing assistant output detected · verifying terminal state':
     'Đã thấy phản hồi trước · đang kiểm tra dấu kết thúc lượt',
  'Adopted latest manual user turn · waiting for assistant without Send':
     'Đã nhận lượt người dùng mới nhất · chờ ChatGPT, không gửi thêm',
  'Capturing export...':'Đang thu thập dữ liệu để xuất...',
  'Export found no conversation data.':'Không tìm thấy dữ liệu cuộc trò chuyện để xuất.',
  'Diagnostic report copied.':'Đã sao chép báo cáo chẩn đoán.',
  'Custom AoA path saved.':'Đã lưu đường dẫn AoA tùy chỉnh.',
  'Custom AoA path cleared.':'Đã xóa đường dẫn AoA tùy chỉnh.',
  'Job stopped by operator.':'Người dùng đã dừng Ghost.',
  'Model relay requested':'Đã yêu cầu chuyển mô hình',
  'Đang chờ người dùng.':'Đang chờ người dùng xử lý.',
  'Auto Play/recovery đang bị khóa.':'Tự động chạy và khôi phục đang bị khóa.',
  'HUMAN REQUIRED':'Cần người dùng xử lý',
  'MODEL RELAY':'Cần chuyển mô hình',
  'CONTEXT LIMIT':'Giới hạn hội thoại',
  'AUTH REQUIRED':'Cần xác thực',
  'RECOVERY EXHAUSTED':'Đã hết lượt khôi phục',
  'OPERATOR REQUIRED':'Cần người dùng xử lý',
  'HOST: BUSY':'ChatGPT: đang xử lý','HOST: IDLE':'ChatGPT: đang nghỉ',
  'Đang gửi status probe sau IDLE xác nhận.':'Đang gửi yêu cầu kiểm tra sau khi xác nhận ChatGPT đã nghỉ.',
  'busy confirmed':'đã xác nhận đang xử lý',
  'waiting':'đang chờ',
  'Ghost runtime destroyed':'Bộ máy Ghost đã dừng',
  'Telegram network error':'Lỗi kết nối Telegram',
  'Telegram timeout':'Telegram phản hồi quá thời gian',
  'Secure random unavailable':'Không có bộ tạo số ngẫu nhiên bảo mật',
  'Chưa có destination':'Chưa thiết lập nơi nhận',
  'ALERT':'Cảnh báo',
  'Core Send journal chưa xác minh; Web Recovery không gửi thêm probe.':
    'Lịch sử gửi của lõi chưa được xác minh; khôi phục kết nối không gửi thêm yêu cầu kiểm tra.',
  'Status probe không được xác nhận và không đủ bằng chứng chứng minh send FAILED. Outcome thật sự uncertain; cần kiểm tra thủ công.':
    'Chưa xác nhận yêu cầu kiểm tra trạng thái và chưa có bằng chứng gửi thất bại. Kết quả chưa rõ; cần kiểm tra thủ công.',
  'Outcome thật sự uncertain; cần kiểm tra thủ công.':
    'Kết quả gửi chưa rõ; cần kiểm tra thủ công.',
  'Continuity lease':'Thời hạn duy trì tác vụ',
  'Ngân sách turn':'Giới hạn thời gian mỗi lượt',
  '80% wrap · 90% checkpoint · không tự Stop':
    '80%: tổng kết · 90%: lưu mốc · không tự dừng',
  'wrap up':'đang tổng kết',
  'quá budget · chờ safe checkpoint':'quá thời hạn · chờ mốc an toàn',
  'IDLE nghi treo':'đang nghỉ, nghi bị treo',
  'ChatGPT có vẻ IDLE/stalled. Tự khôi phục đang tắt.':
    'ChatGPT có vẻ đã ngừng tiến triển. Chế độ tự khôi phục đang tắt.',
  'Đã gửi status probe để reconcile trạng thái hiện tại.':
    'Đã gửi yêu cầu kiểm tra để xác minh trạng thái hiện tại.',
  'Job':'Tác vụ','Reminder':'Nhắc lại','Reason':'Nguyên nhân','Status':'Trạng thái',
  'RUNNING':'Đang chạy','PAUSED':'Đã tạm dừng','IDLE':'Đang nghỉ','BUSY':'Đang xử lý',
  'waiting for response':'đang chờ phản hồi',
  'Core must be running.':'Lõi Ghost phải ở trạng thái đang chạy.',
  'Ghost+ test OK':'Kiểm tra Ghost+ thành công','Alerts ready.':'Đã sẵn sàng nhận cảnh báo.'
});
const EXTRA=Object.freeze({
  'Model Relay':'Chuyển mô hình','Human Gate':'Cổng quyết định của người dùng',
  'HUMAN':'Cần người dùng','RELAY':'Chuyển mô hình',
  'PLAY_SEND_UNCERTAIN':'Chưa xác minh được kết quả gửi',
  'PLAY-SEND-UNCERTAIN':'Chưa xác minh được kết quả gửi',
  'PLAY-SEND-THREW':'Lỗi khi thực hiện gửi',
  'MESSAGE_DELIVERY_TIMEOUT':'Chưa nhận được xác nhận giao tin nhắn',
  'GENERATION_ERROR':'Lỗi tạo phản hồi',
  'NETWORK_ERROR':'Lỗi kết nối mạng',
  'CONNECTION_INTERRUPTED':'Kết nối bị gián đoạn',
  'RECOVERY_SEND_FAILED':'Gửi yêu cầu khôi phục thất bại',
  'SEND_TIMEOUT':'Gửi quá thời gian',
  'RECOVERY_EXHAUSTED':'Đã hết lượt khôi phục',
  'GATE_AUTO_RECONCILED':'Đã tự xác minh và mở chốt',
  'FALSE_TRIAGE_GATE_CLEARED':'Đã gỡ chốt phân loại sai',
  'LEGACY_OPERATIONAL_GATE_CLEARED':'Đã gỡ chốt vận hành cũ',
  'Existing user turn detected · awaiting assistant output without resending':
     'Đã phát hiện lượt người dùng có sẵn · chờ ChatGPT mà không gửi lại',
  'Existing user turn detected · awaiting assistant output without resending':
     'Đã phát hiện tin nhắn người dùng · chờ ChatGPT phản hồi, không gửi lại',
  'Đã chặn recovery probe trong lúc gate khóa.':
     'Đã chặn yêu cầu kiểm tra khôi phục khi chốt an toàn đang khóa.',
  'Ghost+ watcher':'Ghost+ · Bộ theo dõi',
  'Đã lưu yêu cầu ưu tiên cho lần recovery kế tiếp.':
     'Đã lưu yêu cầu ưu tiên cho lần khôi phục tiếp theo.',
  'Khôi phục kết nối không thể tiếp tục an toàn; cần người dùng kiểm tra.':
     'Không thể khôi phục kết nối an toàn. Cần người dùng kiểm tra.',
  'Ghost+ · HUMAN REQUIRED':'Ghost+ · Cần người dùng xử lý',
  'Ghost+ · MODEL RELAY':'Ghost+ · Cần chuyển mô hình',
  'Ghost+ · CONTEXT LIMIT':'Ghost+ · Giới hạn hội thoại',
  'Ghost+ · AUTH REQUIRED':'Ghost+ · Cần xác thực',
  'Ghost+ · RECOVERY EXHAUSTED':'Ghost+ · Hết lượt khôi phục',
  'Ghost+ · OPERATOR REQUIRED':'Ghost+ · Cần người dùng xử lý'
});
const EXTRA_RULES=[
  [/^Staging (.+)\.\.\.$/,(m,what)=>'Đang chuẩn bị '+({
    'initial task':'yêu cầu đầu tiên','protocol reground':'yêu cầu đồng bộ giao thức',
    'continue':'yêu cầu tiếp tục'
  }[what]||'yêu cầu '+what)+'...'],
  [/^(.+) · round (\d+)\/(\d+)$/,(m,s,n,max)=>
    (STATES[s]||display(s))+' · lượt '+n+'/'+max],
  [/^Ghost\+ · ([A-Z][A-Z_ ]+)$/,(m,code)=>
    'Ghost+ · '+(STATES[code.replaceAll(' ','_')]||EXTRA['Ghost+ · '+code]||code)],
  [/^([A-Z][A-Z_ ]+) · ([A-Z]{3}-[A-Z0-9-]+-\d{3})(.*)$/,(m,s,id,rest)=>
    (STATES[s.replaceAll(' ','_')]||EXTRA[s]||s)+' · '+id+rest],
  [/^((?:PLAY|SEND|CORE|WEB|HOST|RECOVERY)[-_][A-Z0-9_-]+): (.+)$/,(m,code,why)=>
    'Ghost gặp lỗi ('+code+'): '+(DIAGNOSTICS[why]||EXACT[why]||EXTRA[why]||why)],
  [/^(.+) (\d+)m$/,(m,text,min)=>text+' '+min+' phút'],
  [/^Không thấy tiến triển (\d+)s\. Bắt đầu thời gian đệm (\d+)s\.$/,(m,s,g)=>
    'Không thấy tiến triển trong '+s+' giây. Bắt đầu thời gian đệm '+g+' giây.']
];

const RULES=[
  [/^Terminal detected · (.+)$/,(m,x)=>'Đã nhận dấu kết thúc lượt · '+(STATES[x.toUpperCase()]||({
    proceed:'Tiếp tục',halt:'Hoàn thành',human:'Cần người dùng',relay:'Chuyển mô hình'
  })[x]||x)],
  [/^Sent once · (.+)$/,(m,x)=>'Đã gửi một lần · '+x],
  [/^Adopted active ChatGPT turn · ([^·]+) · monitoring without sending$/,(m,x)=>
    'Đã nhận lượt ChatGPT đang chạy · '+x.trim()+' · chỉ theo dõi, không gửi thêm'],
  [/^ChatGPT (?:switched to|became) BUSY before (?:Ghost Send|actuation) · adopted active turn without sending$/,_=>
    'ChatGPT bắt đầu xử lý trước khi Ghost gửi · đã nhận lượt đang chạy, không gửi thêm'],
  [/^Copied (\d+) turns · (.+)$/,(m,count,src)=>'Đã sao chép '+count+' lượt · '+src.replace('partial','chưa đầy đủ')],
  [/^(Markdown|JSON) exported · (.+)$/,(m,kind,src)=>'Đã xuất '+kind+' · '+src.replace('partial','chưa đầy đủ')],
  [/^(.+) (enabled|disabled) for the next injected prompt\.$/,(m,name,state)=>
    name+' '+(state==='enabled'?'đã bật':'đã tắt')+' cho yêu cầu tiếp theo.'],
  [/^Reconciled ([\w-]+): ([\w-]+)\. No replay\.$/,(m,id,reason)=>
    'Đã xác minh và mở chốt '+id+': '+(EXACT[reason]||reason)+'. Không gửi lại.'],
  [/^Operator resumed ([\w-]+): adopted active ChatGPT turn without Send\.$/,(m,id)=>
    'Đã tiếp tục '+id+': nhận lượt ChatGPT đang xử lý, không gửi thêm.'],
  [/^Resume ([\w-]+): Core đã xác nhận Send receipt\.$/,(m,id)=>
    'Đã tiếp tục '+id+': lõi xác nhận gửi thành công.'],
  [/^Play bị khóa bởi ([\w-]+) · (.+)\.$/,(m,state,id)=>
    'Chức năng chạy đang bị chặn: '+(STATES[state]||state)+' · '+id+'.'],
  [/^Ghost đang RUNNING; ChatGPT vẫn báo BUSY nhưng (\d+) phút chưa có meaningful progress\. Chỉ cảnh báo một lần cho stall episode này, không Stop\/recovery\.$/,(m,n)=>
    'Ghost đang chạy; ChatGPT vẫn xử lý nhưng '+n+' phút chưa có tiến triển rõ ràng. Chỉ cảnh báo một lần; không dừng hoặc khôi phục.'],
  [/^Không còn BUSY evidence và đã IDLE (\d+)s\. Bắt đầu grace (\d+)s\.$/,(m,n,grace)=>
    'Không còn dấu hiệu ChatGPT đang xử lý trong '+n+' giây. Bắt đầu thời gian đệm '+grace+' giây.'],
  [/^Không thấy progress (\d+)s\. Bắt đầu grace (\d+)s\.$/,(m,n,grace)=>
    'Không thấy tiến triển trong '+n+' giây. Bắt đầu thời gian đệm '+grace+' giây.'],
  [/^Watchdog khóa · (.+)$/,(m,x)=>'Bộ theo dõi tạm ngừng can thiệp · '+x],
  [/^Không có BUSY evidence trong (.+)\.$/,(m,x)=>'Không có dấu hiệu đang xử lý trong '+x+'.'],
  [/^IDLE watchdog (.+) \/ (\d+)m$/,(m,elapsed,min)=>
    'Theo dõi lúc nghỉ '+elapsed+' / '+min+' phút'],
  [/^Đã gửi recovery status probe (.+)$/,(m,x)=>'Đã gửi yêu cầu kiểm tra khôi phục '+x],
  [/^ChatGPT vẫn đang thực thi \((.+)\)\. Không recovery\.$/,(m,x)=>
    'ChatGPT vẫn đang xử lý ('+x+'). Không khôi phục.'],
  [/^(.+) · Controller: HARD_GATE · Host: BUSY \(không can thiệp\)$/,(m,id)=>
    id+' · Ghost: chốt an toàn · ChatGPT: đang xử lý (không can thiệp)'],
  [/^(.+) · Controller: HARD_GATE · Host: IDLE$/,(m,id)=>
    id+' · Ghost: chốt an toàn · ChatGPT: đang nghỉ']
];
const DIAGNOSTICS=Object.freeze({
  'Message delivery timed out':'Không xác nhận được tin nhắn đã được giao trong thời gian quy định.',
  'Resume stream unavailable':'Không thể nối lại luồng phản hồi.',
  'Connection interrupted':'Kết nối bị gián đoạn.',
  'Too many requests':'Đã gửi quá nhiều yêu cầu, cần chờ trước khi thử lại.',
  'There was a problem generating a response':'ChatGPT gặp lỗi khi tạo phản hồi.',
  'Network error':'Lỗi kết nối mạng.',
  'Authentication required':'Cần đăng nhập hoặc xác thực lại.',
  'Something went wrong':'Đã xảy ra sự cố.',
  'Unable to send message':'Không thể gửi tin nhắn.',
  'Your conversation is too long':'Cuộc trò chuyện đã quá dài.',
  'Type a task into the chat first, then press Play.':
    'Hãy nhập yêu cầu vào ô chat trước, sau đó bấm Chạy.',
  'Existing chat detected · monitoring only until a turn becomes visible':
    'Đã nhận diện cuộc chat hiện có · chỉ theo dõi cho đến khi xuất hiện lượt mới',
  'Could not reliably stage the prompt':
    'Không thể chuẩn bị yêu cầu một cách đáng tin cậy',
  'No reliable user-turn baseline. Refusing Send.':
    'Không có mốc lượt người dùng đủ tin cậy. Ghost từ chối gửi.',
  'Cannot persist the at-most-once Send journal; no click attempted.':
    'Không thể lưu sổ giao dịch gửi một lần; chưa thực hiện bấm gửi.',
  'Send actuation threw or became uncertain. Ghost stopped to prevent a duplicate.':
    'Thao tác gửi gặp lỗi hoặc kết quả chưa rõ. Ghost đã dừng để tránh gửi trùng.',
  'Send threw after actuation. Ghost stopped to prevent a duplicate.':
    'Lỗi phát sinh sau khi thử gửi. Ghost đã dừng để tránh gửi trùng.',
  'Send was attempted but host acceptance could not be confirmed. Ghost will not resend.':
    'Đã thử gửi nhưng ChatGPT chưa xác nhận tiếp nhận. Ghost sẽ không gửi lại.',
  'Receipt was observed but durable confirmation could not be stored. No further Send.':
    'Đã thấy xác nhận gửi nhưng không lưu được bằng chứng bền vững. Không gửi thêm.',
  'ChatGPT host control could not be resolved as Stop, Send, or explicit fault-idle; Ghost will not send.':
    'Không xác định được nút điều khiển ChatGPT ở trạng thái gửi, dừng hoặc nghỉ do lỗi. Ghost không gửi.',
  'ChatGPT stream state is desynchronized':
    'Trạng thái luồng ChatGPT không đồng bộ',
  'The current chat composer was not found.':
    'Không tìm thấy ô nhập của cuộc trò chuyện hiện tại.',
  'Current chat composer was not found.':
    'Không tìm thấy ô nhập của cuộc trò chuyện hiện tại.',
  'Unresolved prior Send journal; reconcile its receipt before any new Send.':
    'Lần gửi trước chưa có bằng chứng xác nhận. Phải đối chiếu trước khi gửi mới.',
  'Prompt is staged, but the current host Send control did not become ready':
    'Yêu cầu đã chuẩn bị, nhưng nút Gửi của ChatGPT chưa sẵn sàng',
  'Prompt is still staged, but Send became unsafe before actuation':
    'Yêu cầu vẫn nằm trong ô nhập nhưng thao tác Gửi không còn an toàn',
  'Ghost+ web supervisor':'Ghost+ · Giám sát kết nối'
});

function display(value){
 const s=String(value??'');
 if(Object.prototype.hasOwnProperty.call(STATES,s))return STATES[s];
 if(Object.prototype.hasOwnProperty.call(EXACT,s))return EXACT[s];
 if(Object.prototype.hasOwnProperty.call(EXTRA,s))return EXTRA[s];
 if(Object.prototype.hasOwnProperty.call(DIAGNOSTICS,s))return DIAGNOSTICS[s];
 for(const [re,fn] of EXTRA_RULES)if(re.test(s))return s.replace(re,fn);
 for(const [re,fn] of RULES)if(re.test(s))return s.replace(re,fn);
 return s;
}
function interpolate(key,values={}){
 return display(key).replace(/\{([a-zA-Z]\w*)\}/g,(m,k)=>Object.prototype.hasOwnProperty.call(values,k)?String(values[k]):m);
}
function event(e={}){
 const code=String(e.type||'');
 const label=STATES[code]||EXTRA[code]||'';
 const rawTitle=String(e.title??'');
 const title=/^Ghost\+ · (?:HUMAN REQUIRED|MODEL RELAY|CONTEXT LIMIT|AUTH REQUIRED|RECOVERY EXHAUSTED|OPERATOR REQUIRED)$/.test(rawTitle)&&label
    ?'Ghost+ · '+label:display(rawTitle);
 const text=display(e.text??'');
 const reason=display(e.reason??'');
 return {...e,title,text,reason};
}
window.__ghostPlusI18n=Object.freeze({locale:'vi-VN',display,state:(v)=>STATES[v]||display(v),
  event,interpolate,known:v=>Object.prototype.hasOwnProperty.call(EXACT,String(v))||
    Object.prototype.hasOwnProperty.call(STATES,String(v))||RULES.some(([re])=>re.test(String(v)))});
RT.cleanup(()=>{if(window.__ghostPlusI18n?.locale==='vi-VN')delete window.__ghostPlusI18n});
})();