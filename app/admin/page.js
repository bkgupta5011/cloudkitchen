'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './admin.module.css'
import { usePushNotifications } from '@/lib/usePush'
import { RECIPES, RECIPE_CATEGORIES, COMBO_GUIDE, KITCHEN_STANDARDS, printRecipeBook } from '@/lib/recipes'

const SECTIONS = [
  { id: 'orders',    label: '📋 Orders',           badge: 'orders' },
  { id: 'menu',      label: '🍛 Menu Items' },
  { id: 'offers',    label: '🏷️ Offers' },
  { id: 'boys',      label: '🛵 Delivery Boys' },
  { id: 'apps',      label: '📝 Applications',     badge: 'apps' },
  { id: 'kitchen',   label: '⚙️ Kitchen Settings' },
  { id: 'pricing',   label: '📏 KM Pricing' },
  { id: 'customers', label: '👥 Customers' },
  { id: 'support',   label: '💬 Support',           badge: 'support' },
  { id: 'analytics', label: '📊 Analytics' },
  { id: 'notices',   label: '📣 Notices' },
  { id: 'broadcast', label: '📢 Broadcast' },
  { id: 'stock',     label: '📦 Stock',         badge: 'stock' },
  { id: 'recipes',   label: '📖 Recipe Book' },
]

export default function AdminPage() {
  const router = useRouter()
  usePushNotifications(true) // Admin always subscribes to push
  const [section, setSection] = useState('orders')
  const [stockItems, setStockItems] = useState([])
  const [stockLoading, setStockLoading] = useState(false)
  const [kitchenOpen, setKitchenOpen] = useState(true)
  const [kitchenSettings, setKitchenSettings] = useState({ kitchen_name:'', address:'', phone:'', lat:'', lng:'', max_delivery_km:5, open_time:'09:00', close_time:'22:00', estimated_time:45, auto_schedule:false, order_timeout_minutes:2, escalation_interval_sec:30 })
  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [offers, setOffers] = useState([])
  const [boys, setBoys] = useState([])
  const [pendingBoys, setPendingBoys] = useState([])
  const [pricing, setPricing] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [apiUsage, setApiUsage] = useState(null)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddOffer, setShowAddOffer] = useState(false)
  const [showOrderDetail, setShowOrderDetail] = useState(false)
  const [orderDetail, setOrderDetail] = useState(null)
  const [showManualOrder, setShowManualOrder] = useState(false)
  const [manualOrder, setManualOrder] = useState({ customerName:'', customerPhone:'', address:'', notes:'', deliveryCharge:30, items:{} })
  const [newItem, setNewItem] = useState({ name:'', description:'', price:'', discount_percent:0, category:'Rice Combos', is_veg:true, image_url:'' })
  const [newOffer, setNewOffer] = useState({ code:'', type:'percent', value:'', min_order:'', max_uses:1000, valid_till:'' })
  const [showBoyDetail, setShowBoyDetail] = useState(false)
  const [boyDetail, setBoyDetail] = useState(null)
  const [editBoyMode, setEditBoyMode] = useState(false)
  const [boyEditForm, setBoyEditForm] = useState({})
  const [showPayModal, setShowPayModal] = useState(false)
  const [payBoy, setPayBoy] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [payHistory, setPayHistory] = useState([])
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutBoy, setPayoutBoy] = useState(null)
  const [payoutData, setPayoutData] = useState(null)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [notices, setNotices] = useState([])
  const [newNotice, setNewNotice] = useState({ message: '', emoji: '📢' })
  const [noticeEmojis] = useState(['📢', '🎉', '🔥', '❤️', '🍽️', '✨', '🎁', '💯', '🙏', '👋'])
  const [uploadingImg, setUploadingImg] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [showSupport, setShowSupport] = useState(false)
  const [supportThreads, setSupportThreads] = useState([])
  const [activeChatUser, setActiveChatUser] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Date range for order history — default: today (IST)
  const todayIST = () => {
    const now = new Date()
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    return ist.toISOString().slice(0, 10)
  }
  const [dateFrom, setDateFrom] = useState(todayIST())
  const [dateTo,   setDateTo]   = useState(todayIST())
  const [notifCount, setNotifCount] = useState(0)
  const [toast, setToast] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({ title: '', body: '', target: 'customer', url: '' })
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)
  // Recipe Book
  const [recipeCat, setRecipeCat] = useState('Sab Recipes')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [expandedRecipe, setExpandedRecipe] = useState(null)
  const [recipeTab, setRecipeTab] = useState({}) // { recipeId: 'ingredients'|'vidhi'|'serving' }
  const lastOrderCount = useRef(0)
  const lastAppCount = useRef(0)
  const alertCtxRef = useRef(null)
  const supportCtxRef = useRef(null)
  const escalationCtxRef = useRef(null)
  const lastSupportUnread = useRef({})   // userId → unreadCount
  const activeChatUserRef = useRef(null) // activeChatUser ka current value (for closure use)
  const escalatedOrderIds = useRef(new Set())   // escalation already triggered for these
  const escalationTimerRef = useRef(null)        // repeating escalation interval
  const kitchenSettingsRef = useRef({ order_timeout_minutes: 2, escalation_interval_sec: 30 }) // closure-safe copy

  const playLoudAlert = () => {
    try {
      // Pehle wala alert band karo agar chal raha ho
      if (alertCtxRef.current) { try { alertCtxRef.current.close() } catch {} }
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      alertCtxRef.current = ctx

      // 10 second ka alarm — har 0.55s pe ek ding-dong pair
      const totalSecs = 10
      const step = 0.55
      const numBeeps = Math.ceil(totalSecs / step) // ~18 pairs

      for (let i = 0; i < numBeeps; i++) {
        const base = ctx.currentTime + i * step

        // Pehla tone — 880Hz
        const o1 = ctx.createOscillator(), g1 = ctx.createGain()
        o1.type = 'square'; o1.frequency.value = 880
        o1.connect(g1); g1.connect(ctx.destination)
        g1.gain.setValueAtTime(0.9, base)
        g1.gain.exponentialRampToValueAtTime(0.001, base + 0.22)
        o1.start(base); o1.stop(base + 0.23)

        // Doosra tone — 1100Hz (0.27s baad)
        const o2 = ctx.createOscillator(), g2 = ctx.createGain()
        o2.type = 'square'; o2.frequency.value = 1100
        o2.connect(g2); g2.connect(ctx.destination)
        g2.gain.setValueAtTime(0.9, base + 0.27)
        g2.gain.exponentialRampToValueAtTime(0.001, base + 0.50)
        o2.start(base + 0.27); o2.stop(base + 0.51)
      }

      // 10 second baad auto-close
      setTimeout(() => { try { ctx.close() } catch {}; alertCtxRef.current = null }, 11000)
    } catch (e) {}
  }

  // Support chat ke liye 2-second distinct tone (sine wave — softer than order alarm)
  const playSupportAlert = () => {
    try {
      if (supportCtxRef.current) { try { supportCtxRef.current.close() } catch {} }
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      supportCtxRef.current = ctx
      const totalSecs = 2, step = 0.5, numBeeps = Math.ceil(totalSecs / step)
      for (let i = 0; i < numBeeps; i++) {
        const base = ctx.currentTime + i * step
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = i % 2 === 0 ? 700 : 900
        osc.connect(g); g.connect(ctx.destination)
        g.gain.setValueAtTime(0.75, base)
        g.gain.exponentialRampToValueAtTime(0.001, base + 0.4)
        osc.start(base); osc.stop(base + 0.42)
      }
      setTimeout(() => { try { ctx.close() } catch {}; supportCtxRef.current = null }, 3000)
    } catch {}
  }

  // Escalation alarm — alag urgent tone (rapid triple beep, 1400Hz)
  const playEscalationAlert = () => {
    try {
      if (escalationCtxRef.current) { try { escalationCtxRef.current.close() } catch {} }
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      escalationCtxRef.current = ctx
      // 3 rapid high-pitched beeps
      for (let i = 0; i < 3; i++) {
        const base = ctx.currentTime + i * 0.25
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'square'; osc.frequency.value = 1400
        osc.connect(g); g.connect(ctx.destination)
        g.gain.setValueAtTime(1.0, base)
        g.gain.exponentialRampToValueAtTime(0.001, base + 0.18)
        osc.start(base); osc.stop(base + 0.20)
      }
      setTimeout(() => { try { ctx.close() } catch {}; escalationCtxRef.current = null }, 2000)
    } catch {}
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  useEffect(() => {
    fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'me' }) })
      .then(r => r.json()).then(({ user }) => { if (!user || user.role !== 'admin') router.push('/login') })
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission()
    loadAll()

    // Auto-poll every 10s
    const interval = setInterval(async () => {
      try {
        const [ordRes, appRes] = await Promise.all([
          fetch('/api/orders').then(r => r.json()),
          fetch('/api/admin?type=pending_boys').then(r => r.json()),
        ])
        const latest = ordRes.orders || []
        const activeCount = latest.filter(o => !['delivered','cancelled'].includes(o.status)).length
        if (lastOrderCount.current > 0 && activeCount > lastOrderCount.current) {
          playLoudAlert()
          setNotifCount(n => n + (activeCount - lastOrderCount.current))
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('🍽️ Naya Order!', { body: 'FoodFi Cloud Kitchen pe naya order aa gaya!', icon: '/favicon.ico' })
          }
          // Toast 10 sec tak dikhao (alarm ke saath)
          setToast('🔔 Naya order aa gaya! — Abhi dekho!')
          setTimeout(() => setToast(''), 10000)
        }
        lastOrderCount.current = activeCount
        setOrders(latest)

        // ── Escalation check — pending orders not accepted within timeout ──
        const timeoutMin = kitchenSettingsRef.current.order_timeout_minutes || 2
        const nowMs = Date.now()
        const overdueOrders = latest.filter(o =>
          o.status === 'pending' &&
          (nowMs - new Date(o.created_at)) > timeoutMin * 60 * 1000
        )
        for (const o of overdueOrders) {
          if (!escalatedOrderIds.current.has(o.id)) {
            escalatedOrderIds.current.add(o.id)
            // Start repeating escalation alarm
            playEscalationAlert()
            setToast(`🚨 Order #${o.order_number} ${timeoutMin} min se pending! — Abhi accept karo!`)
            setTimeout(() => setToast(''), 8000)
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(`🚨 Order Miss Ho Raha Hai!`, { body: `Order #${o.order_number} kaafi der se pending hai. Abhi accept karo!`, icon: '/favicon.ico' })
            }
          }
        }
        // Accepted orders ko escalation set se hataao
        const pendingIds = new Set(latest.filter(o => o.status === 'pending').map(o => o.id))
        for (const id of [...escalatedOrderIds.current]) {
          if (!pendingIds.has(id)) escalatedOrderIds.current.delete(id)
        }

        const apps = appRes.boys || []
        if (lastAppCount.current > 0 && apps.length > lastAppCount.current) showToast('📝 Naya delivery boy application!')
        lastAppCount.current = apps.length
        setPendingBoys(apps)

        // ── Support chat polling ──
        try {
          const suppRes = await fetch('/api/support').then(r => r.json())
          const threads = suppRes.threads || []
          setSupportThreads(threads)

          // Pehle load ke baad hi alert bajao
          if (Object.keys(lastSupportUnread.current).length > 0) {
            for (const t of threads) {
              const newUnread = parseInt(t.unread_count || 0)
              const prevUnread = lastSupportUnread.current[t.user_id] || 0
              // Naya unread message aaya — aur woh customer ka chat ABHI open nahi hai
              if (newUnread > prevUnread && activeChatUserRef.current !== t.user_id) {
                playSupportAlert()
                setToast(`💬 ${t.user_name} ka naya message!`)
                setTimeout(() => setToast(''), 4000)
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                  new Notification(`💬 ${t.user_name}`, { body: t.message?.slice(0,60) || 'Naya message', icon: '/favicon.ico' })
                }
              }
              lastSupportUnread.current[t.user_id] = newUnread
            }
          } else {
            // First load — snapshot lo, alert mat bajao
            threads.forEach(t => { lastSupportUnread.current[t.user_id] = parseInt(t.unread_count || 0) })
          }
        } catch {}

      } catch (e) {}
    }, 10000)

    // Escalation repeating alarm — escalation_interval_sec ke baad phir bajao agar order abhi bhi pending ho
    const escInterval = setInterval(() => {
      if (escalatedOrderIds.current.size > 0) {
        playEscalationAlert()
      }
    }, (kitchenSettingsRef.current.escalation_interval_sec || 30) * 1000)
    escalationTimerRef.current = escInterval

    return () => { clearInterval(interval); clearInterval(escInterval) }
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const t = todayIST()
    const [settingsRes, ordersRes, menuRes, offersRes, boysRes, pendingRes, pricingRes, analyticsRes, customersRes, noticesRes] = await Promise.all([
      fetch('/api/admin').then(r => r.json()),
      fetch(`/api/orders?date_from=${t}&date_to=${t}`).then(r => r.json()),
      fetch('/api/menu?admin=true').then(r => r.json()),
      fetch('/api/admin?type=offers').then(r => r.json()),
      fetch('/api/admin?type=delivery_boys').then(r => r.json()),
      fetch('/api/admin?type=pending_boys').then(r => r.json()),
      fetch('/api/admin?type=pricing').then(r => r.json()),
      fetch('/api/admin?type=analytics').then(r => r.json()),
      fetch('/api/admin?type=customers').then(r => r.json()),
      fetch('/api/notices').then(r => r.json()),
    ])
    const s = settingsRes.settings || {}
    setKitchenOpen(s.is_open ?? true)
    const ks = { kitchen_name: s.kitchen_name||'', address: s.address||'', phone: s.phone||'', lat: s.lat||'', lng: s.lng||'', max_delivery_km: s.max_delivery_km||5, open_time: s.open_time||'09:00', close_time: s.close_time||'22:00', estimated_time: s.estimated_time||45, auto_schedule: s.auto_schedule||false, order_timeout_minutes: s.order_timeout_minutes||2, escalation_interval_sec: s.escalation_interval_sec||30 }
    setKitchenSettings(ks)
    kitchenSettingsRef.current = ks
    const loadedOrders = ordersRes.orders || []
    setOrders(loadedOrders)
    lastOrderCount.current = loadedOrders.filter(o => !['delivered','cancelled'].includes(o.status)).length
    setMenuItems(menuRes.items || [])
    setOffers(offersRes.offers || [])
    setBoys(boysRes.boys || [])
    const apps = pendingRes.boys || []
    setPendingBoys(apps)
    lastAppCount.current = apps.length
    setPricing(pricingRes.pricing || [])
    setAnalytics(analyticsRes)
    setCustomers(customersRes.customers || [])
    setNotices(noticesRes?.notices || [])
    setLoading(false)
  }

  const toggleKitchen = async () => {
    const newVal = !kitchenOpen; setKitchenOpen(newVal)
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'kitchen', is_open:newVal }) })
    showToast(newVal ? '✅ Kitchen OPEN hai' : '🔴 Kitchen CLOSED hai')
  }

  const saveKitchenSettings = async () => {
    try {
      const res = await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'kitchen', ...kitchenSettings }) })
      if (!res.ok) {
        const err = await res.text()
        showToast(`❌ Save failed (${res.status}): ${err.slice(0,80)}`)
        console.error('Kitchen save error:', res.status, err)
        return
      }
      const json = await res.json()
      console.log('Kitchen saved. DB returned:', json.settings)
      kitchenSettingsRef.current = kitchenSettings
      // Sync state with what DB actually saved
      if (json.settings) {
        setKitchenSettings(s => ({ ...s,
          open_time: json.settings.open_time || s.open_time,
          close_time: json.settings.close_time || s.close_time,
          estimated_time: json.settings.estimated_time || s.estimated_time,
        }))
      }
      showToast('✅ Kitchen settings save ho gayi!')
    } catch(e) {
      showToast('❌ Network error: ' + e.message)
      console.error('Kitchen save exception:', e)
    }
  }

  const fetchOrdersByDate = async (from, to) => {
    try {
      const res = await fetch(`/api/orders?date_from=${from}&date_to=${to}`).then(r => r.json())
      setOrders(res.orders || [])
    } catch {}
  }

  const updateOrderStatus = async (orderId, status) => {
    await fetch('/api/orders', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId, status }) })
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
  }

  const assignBoy = async (orderId, boyId) => {
    await fetch('/api/orders', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId, deliveryBoyId: boyId }) })
    const boy = boys.find(b => b.id === boyId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivery_boy_id: boyId, delivery_boy_name: boy?.name } : o))
    showToast('✅ Delivery boy assign ho gaya!')
  }

  const openOrderDetail = async (orderId) => {
    const res = await fetch(`/api/orders?id=${orderId}`).then(r => r.json())
    setOrderDetail(res.order); setShowOrderDetail(true)
  }

  const submitManualOrder = async (e) => {
    e.preventDefault()
    if (!Object.values(manualOrder.items).some(q => q > 0)) { showToast('❌ Kam se kam ek item select karo'); return }
    showToast('⏳ Order create ho raha hai...')
    const res = await fetch('/api/orders/manual', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(manualOrder) })
    const data = await res.json()
    if (!res.ok) { showToast('❌ ' + data.error); return }
    setShowManualOrder(false)
    setManualOrder({ customerName:'', customerPhone:'', address:'', notes:'', deliveryCharge:30, items:{} })
    loadAll()
    showToast(`✅ Manual order #${data.orderNumber} create ho gaya!`)
  }

  const approveDeliveryBoy = async (id) => {
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'approve_boy', id }) })
    setPendingBoys(prev => prev.filter(b => b.id !== id))
    showToast('✅ Delivery boy approved!')
    loadAll()
  }

  const rejectDeliveryBoy = async (id) => {
    if (!confirm('Is application ko reject karna chahte ho?')) return
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reject_boy', id }) })
    setPendingBoys(prev => prev.filter(b => b.id !== id))
    showToast('🗑️ Application reject ho gayi')
  }

  const suspendBoy = async (id) => {
    if (!confirm('Is delivery boy ko suspend karna chahte ho?')) return
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'suspend_boy', id }) })
    showToast('🚫 Delivery boy suspend ho gaya')
    loadAll()
  }

  const reactivateBoy = async (id) => {
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reactivate_boy', id }) })
    showToast('✅ Delivery boy reactivate ho gaya')
    loadAll()
  }

  const toggleMenuItem = async (itemId, val) => {
    await fetch('/api/menu', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:itemId, is_available:val }) })
    setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, is_available:val } : m))
  }

  const updateItemPrice = async (itemId, price, disc) => {
    await fetch('/api/menu', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:itemId, price:parseFloat(price), discount_percent:parseInt(disc) }) })
    showToast('✅ Price update ho gayi!')
  }

  const addNewItem = async (e) => {
    e.preventDefault()
    await fetch('/api/menu', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newItem) })
    setShowAddItem(false)
    setNewItem({ name:'', description:'', price:'', discount_percent:0, category:'Rice Combos', is_veg:true })
    await loadAll()
    showToast('✅ Item add ho gaya!')
  }

  const addNewOffer = async (e) => {
    e.preventDefault()
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'offer', ...newOffer }) })
    setShowAddOffer(false)
    setNewOffer({ code:'', type:'percent', value:'', min_order:'', max_uses:1000, valid_till:'' })
    await loadAll()
    showToast('✅ Offer create ho gaya!')
  }

  const savePricing = async () => {
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'pricing', rows:pricing }) })
    showToast('✅ Pricing save ho gayi!')
  }

  // Upload image — client-side resize then base64
  const uploadImage = (file, onDone) => {
    setUploadingImg(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 700
        let { width, height } = img
        if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
        if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        fetch('/api/upload', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ base64, mimeType: 'image/jpeg' })
        }).then(r => r.json()).then(d => {
          setUploadingImg(false)
          if (d.url) onDone(d.url)
          else showToast('❌ Upload failed')
        })
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const updateMenuItemImage = async (itemId, url) => {
    await fetch('/api/menu', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:itemId, image_url:url }) })
    setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, image_url:url } : m))
    showToast('✅ Photo update ho gayi!')
  }

  const openBoyDetail = async (boy) => {
    setBoyDetail(boy)
    setBoyEditForm({ name:boy.name, phone:boy.phone, per_km_earning:boy.per_km_earning||0 })
    setEditBoyMode(false)
    setShowBoyDetail(true)
    // Load payment history
    const d = await fetch(`/api/admin?type=payment_history&boyId=${boy.id}`).then(r => r.json())
    setPayHistory(d.records || [])
  }

  const openPayModal = (boy) => {
    setPayBoy(boy)
    setPayAmount('')
    setPayNotes('')
    setShowPayModal(true)
  }

  const openPayoutModal = async (boy) => {
    setPayoutBoy(boy)
    setPayoutData(null)
    setPayoutLoading(true)
    setShowPayoutModal(true)
    const d = await fetch(`/api/admin?type=payout&boyId=${boy.id}`).then(r => r.json())
    setPayoutData(d)
    setPayoutLoading(false)
  }

  const recordPayment = async (e) => {
    e.preventDefault()
    if (!parseFloat(payAmount) || parseFloat(payAmount) <= 0) { showToast('❌ Valid amount daalo'); return }
    const res = await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ type:'pay_boy', id:payBoy.id, amount:parseFloat(payAmount), notes:payNotes }) })
    const data = await res.json()
    if (data.success) {
      showToast(`✅ ₹${payAmount} payment recorded for ${payBoy.name}`)
      setShowPayModal(false)
      // Update local state
      setBoys(prev => prev.map(b => b.id === payBoy.id ? { ...b, payment_due: data.boy.payment_due, total_paid: data.boy.total_paid } : b))
      if (showBoyDetail && boyDetail?.id === payBoy.id) {
        setBoyDetail(prev => ({ ...prev, payment_due: data.boy.payment_due, total_paid: data.boy.total_paid }))
        // Refresh payment history
        const d = await fetch(`/api/admin?type=payment_history&boyId=${payBoy.id}`).then(r => r.json())
        setPayHistory(d.records || [])
      }
    } else showToast('❌ Payment record failed')
  }

  const saveBoyEdit = async () => {
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ type:'update_boy', id:boyDetail.id, ...boyEditForm }) })
    showToast('✅ Details update ho gayi!')
    setBoyDetail(prev => ({ ...prev, ...boyEditForm }))
    setEditBoyMode(false)
    loadAll()
  }

  const loadSupportThreads = async () => {
    const d = await fetch('/api/support').then(r => r.json())
    const threads = d.threads || []
    setSupportThreads(threads)
    // Initial unread snapshot (no alert on first load)
    if (Object.keys(lastSupportUnread.current).length === 0) {
      threads.forEach(t => { lastSupportUnread.current[t.user_id] = parseInt(t.unread_count || 0) })
    }
    return threads
  }

  const loadChat = async (userId) => {
    activeChatUserRef.current = userId  // ref update karo (closure ke liye)
    setActiveChatUser(userId)
    const d = await fetch(`/api/support?userId=${userId}`).then(r => r.json())
    setChatMessages(d.messages || [])
    // Is user ka unread reset karo (chat open hai ab)
    lastSupportUnread.current[userId] = 0
    setSupportThreads(prev => prev.map(t => t.user_id === userId ? { ...t, unread_count: 0 } : t))
  }

  const sendAdminReply = async () => {
    if (!chatInput.trim() || !activeChatUser) return
    await fetch('/api/support', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message: chatInput, targetUserId: activeChatUser }) })
    setChatInput('')
    loadChat(activeChatUser)
  }

  const addNotice = async (e) => {
    e.preventDefault()
    if (!newNotice.message.trim()) return
    const res = await fetch('/api/notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newNotice) })
    const data = await res.json()
    if (data.notice) { setNotices(prev => [data.notice, ...prev]); setNewNotice({ message: '', emoji: '📢' }); showToast('✅ Notice post ho gaya!') }
  }
  const toggleNotice = async (id, is_active) => {
    await fetch('/api/notices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active }) })
    setNotices(prev => prev.map(n => n.id === id ? { ...n, is_active } : n))
  }
  const deleteNotice = async (id) => {
    await fetch(`/api/notices?id=${id}`, { method: 'DELETE' })
    setNotices(prev => prev.filter(n => n.id !== id))
    showToast('Notice delete ho gaya')
  }

  const logout = async () => {
    await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'logout' }) })
    router.push('/login')
  }

  // Dark mode — localStorage se restore karo
  useEffect(() => {
    const saved = localStorage.getItem('ck_theme')
    if (saved === 'dark') { setDarkMode(true); document.documentElement.setAttribute('data-theme','dark') }
  }, [])
  const toggleDark = () => {
    const nd = !darkMode; setDarkMode(nd)
    document.documentElement.setAttribute('data-theme', nd ? 'dark' : 'light')
    localStorage.setItem('ck_theme', nd ? 'dark' : 'light')
  }

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)
  // Also add cancelled row styling

  const pendingCount = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length
  const unreadSupport = supportThreads.reduce((a, t) => a + parseInt(t.unread_count || 0), 0)

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><div className="spinner" /></div>

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>⚙️ Admin Panel</div>
        {SECTIONS.map(s => (
          <button key={s.id} className={`${styles.sideLink} ${section === s.id ? styles.active : ''}`}
            onClick={() => { setSection(s.id); if(s.id==='orders') setNotifCount(0); if(s.id==='support') loadSupportThreads(); if(s.id==='analytics') fetch('/api/track-usage').then(r=>r.json()).then(d=>setApiUsage(d)).catch(()=>{}); if(s.id==='stock'){ setStockLoading(true); fetch('/api/admin?type=stock').then(r=>r.json()).then(d=>{ setStockItems(d.items||[]); setStockLoading(false) }).catch(()=>setStockLoading(false)) } }}>
            {s.label}
            {s.badge === 'orders' && pendingCount > 0 && <span className={styles.sideBadge}>{pendingCount}</span>}
            {s.badge === 'apps' && pendingBoys.length > 0 && <span className={styles.sideBadge}>{pendingBoys.length}</span>}
            {s.badge === 'support' && unreadSupport > 0 && <span className={styles.sideBadge}>{unreadSupport}</span>}
            {s.badge === 'stock' && stockItems.filter(i => i.stock_count !== null && i.stock_count <= 2).length > 0 && <span className={styles.sideBadge} style={{background:'#ef4444'}}>{stockItems.filter(i => i.stock_count !== null && i.stock_count <= 2).length}</span>}
          </button>
        ))}
        <button className={styles.logoutBtn} onClick={logout}>🚪 Logout</button>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {/* Top bar */}
        <div className={styles.kitchenCard}>
          <div>
            <strong>🍽️ {kitchenSettings.kitchen_name || 'Kitchen'}</strong>
            <p style={{ fontSize:12, color:'var(--t2)', marginTop:3 }}>Toggle to open or close ordering</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {notifCount > 0 && (
              <div style={{ background:'#dc2626', color:'#fff', borderRadius:20, padding:'4px 12px', fontSize:13, fontWeight:700, cursor:'pointer' }} onClick={() => { setSection('orders'); setNotifCount(0) }}>
                🔔 {notifCount} New Order{notifCount > 1 ? 's' : ''}
              </div>
            )}
            <button onClick={toggleDark} title="Dark Mode Toggle"
              style={{ background:'none', border:'1px solid var(--bd2)', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:16 }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <div className={styles.bigToggle}>
              <div className={`${styles.bigTrack} ${kitchenOpen ? styles.on : ''}`} onClick={toggleKitchen}><div className={styles.bigKnob} /></div>
              <span style={{ fontWeight:600, color: kitchenOpen ? 'var(--gr-d)' : 'var(--rd)', fontSize:14 }}>{kitchenOpen ? 'Open' : 'Closed'}</span>
            </div>
          </div>
        </div>

        {/* ── ORDERS ── */}
        {section === 'orders' && (() => {
          const deliveredRevenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + parseFloat(o.total || 0), 0)
          const deliveredCount   = orders.filter(o => o.status === 'delivered').length
          const pendingCount2    = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length
          const cancelledCount   = orders.filter(o => o.status === 'cancelled').length
          const isToday = dateFrom === todayIST() && dateTo === todayIST()

          const printOrders = () => {
            const rows = filteredOrders.map(o =>
              `<tr>
                <td>#${o.order_number}</td>
                <td>${o.customer_name || ''}<br/><small>${o.customer_phone || ''}</small></td>
                <td>₹${Math.round(o.total)}</td>
                <td>${new Date(o.created_at).toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'})}</td>
                <td><b>${o.status.replace('_',' ')}</b></td>
                <td>${o.delivery_boy_name || '—'}</td>
              </tr>`
            ).join('')
            const win = window.open('', '_blank')
            win.document.write(`
              <html><head><title>FoodFi Orders — ${dateFrom} to ${dateTo}</title>
              <style>
                body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
                h2{margin-bottom:4px}p{color:#666;margin:0 0 12px}
                table{width:100%;border-collapse:collapse}
                th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
                th{background:#f3f4f6;font-weight:700}
                .summary{display:flex;gap:20px;margin-bottom:16px;padding:10px;background:#f9fafb;border-radius:6px}
                .sum-item{text-align:center}.sum-label{font-size:10px;color:#666}.sum-val{font-size:16px;font-weight:700}
              </style></head><body>
              <h2>🍽️ FoodFi Cloud Kitchen — Order Report</h2>
              <p>${dateFrom === dateTo ? dateFrom : dateFrom + ' to ' + dateTo}</p>
              <div class="summary">
                <div class="sum-item"><div class="sum-label">Total Orders</div><div class="sum-val">${orders.length}</div></div>
                <div class="sum-item"><div class="sum-label">Delivered</div><div class="sum-val" style="color:#16a34a">${deliveredCount}</div></div>
                <div class="sum-item"><div class="sum-label">Revenue (Delivered)</div><div class="sum-val" style="color:#e85d04">₹${Math.round(deliveredRevenue)}</div></div>
                <div class="sum-item"><div class="sum-label">Cancelled</div><div class="sum-val" style="color:#dc2626">${cancelledCount}</div></div>
              </div>
              <table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Time</th><th>Status</th><th>Delivery Boy</th></tr></thead>
              <tbody>${rows}</tbody></table>
              <p style="margin-top:12px;color:#aaa;font-size:10px">Printed on ${new Date().toLocaleString('en-IN')} · FoodFi Cloud Kitchen</p>
              </body></html>
            `)
            win.document.close()
            win.print()
          }

          return (
          <>
            {/* Stats */}
            <div className={styles.statsRow}>
              {[
                ['Orders', orders.length, ''],
                ['Revenue (Delivered)', `₹${Math.round(deliveredRevenue)}`, 'var(--or)'],
                ['Pending', pendingCount2, 'var(--am)'],
                ['Delivered', deliveredCount, 'var(--gr-d)'],
              ].map(([label,val,col])=>(
                <div key={label} className={styles.statCard}><div className={styles.statLabel}>{label}</div><div className={styles.statVal} style={{color:col||'var(--t1)'}}>{val}</div></div>
              ))}
            </div>

            {/* Date range + action bar */}
            <div className={styles.sectionHead} style={{ flexWrap:'wrap', gap:10 }}>
              <h2>{isToday ? 'Live Orders' : `Orders: ${dateFrom === dateTo ? dateFrom : dateFrom + ' → ' + dateTo}`}</h2>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                {/* Date range */}
                <input type="date" value={dateFrom} max={todayIST()}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ border:'1px solid var(--bd2)', borderRadius:6, padding:'5px 8px', fontSize:12, color:'var(--t1)', background:'var(--card)' }} />
                <span style={{ fontSize:12, color:'var(--t2)' }}>to</span>
                <input type="date" value={dateTo} max={todayIST()}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ border:'1px solid var(--bd2)', borderRadius:6, padding:'5px 8px', fontSize:12, color:'var(--t1)', background:'var(--card)' }} />
                <button className="btn btn-primary" style={{ fontSize:12 }}
                  onClick={() => fetchOrdersByDate(dateFrom, dateTo)}>🔍 Apply</button>
                <button className="btn btn-secondary" style={{ fontSize:12 }}
                  onClick={() => { const t = todayIST(); setDateFrom(t); setDateTo(t); fetchOrdersByDate(t, t) }}>📅 Today</button>
                <button className="btn btn-secondary" style={{ fontSize:12 }}
                  onClick={() => {
                    const now = new Date(); const ist = new Date(now.getTime() + 5.5*60*60*1000)
                    const y = ist.getDay()
                    const monday = new Date(ist); monday.setDate(ist.getDate() - (y===0?6:y-1))
                    const from = monday.toISOString().slice(0,10); const to = todayIST()
                    setDateFrom(from); setDateTo(to); fetchOrdersByDate(from, to)
                  }}>📆 This Week</button>

                {/* Action buttons */}
                <button className="btn btn-primary" style={{ fontSize:12 }} onClick={() => setShowManualOrder(true)}>📞 Phone Order</button>
                <button className="btn btn-secondary" style={{ fontSize:12 }}
                  onClick={() => window.open(`/api/orders?format=csv&date_from=${dateFrom}&date_to=${dateTo}`)}>⬇️ Excel/CSV</button>
                <button className="btn btn-secondary" style={{ fontSize:12 }} onClick={printOrders}>🖨️ Print</button>

                {/* Status filter */}
                <div className={styles.filters}>
                  {['all','pending','preparing','out_for_delivery','delivered','cancelled'].map(f => (
                    <button key={f} className={`${styles.fChip} ${statusFilter===f?styles.active:''}`} onClick={() => setStatusFilter(f)}>
                      {f==='all'?'All':f==='out_for_delivery'?'Out':f.charAt(0).toUpperCase()+f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.tableWrap}>
            <div className={styles.table}>
              <div className={`${styles.tHead} ${styles.ordCols}`}><span>Order</span><span>Customer</span><span>Amount</span><span>Time</span><span>Status</span><span>Delivery Boy</span></div>
              {filteredOrders.map(o => {
                const rowBg = {
                  pending:          '#fffbeb',
                  confirmed:        '#eff6ff',
                  preparing:        '#f5f3ff',
                  out_for_delivery: '#fff7ed',
                  cancelled:        '#fef2f2',
                }[o.status] || 'transparent'
                return (
                <div key={o.id} className={`${styles.tRow} ${styles.ordCols}`} style={{ background: rowBg }}>
                  <span className={styles.orderId} style={{ cursor:'pointer', textDecoration:'underline', color:'var(--bl)' }} onClick={() => openOrderDetail(o.id)}>#{o.order_number}</span>
                  <div>
                    <div style={{ fontWeight:500, fontSize:12 }}>{o.customer_name}</div>
                    <div style={{ fontSize:11, color:'var(--t2)' }}>{o.customer_phone}</div>
                    <div style={{ fontSize:10, color:'var(--t3)' }}>📍 {o.delivery_address?.slice(0,30)}...</div>
                  </div>
                  <span style={{ fontWeight:500 }}>₹{Math.round(o.total)}</span>
                  <span style={{ fontSize:11, color:'var(--t2)' }}>
                    {isToday
                      ? new Date(o.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
                      : new Date(o.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) + ' ' + new Date(o.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
                    }
                  </span>
                  <select className={styles.statSel} value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)}>
                    {['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'].map(s => (
                      <option key={s} value={s}>{s.replace('_',' ')}</option>
                    ))}
                  </select>
                  <div>
                    {o.delivery_boy_name && <div style={{ fontSize:11, color:'var(--bl)', fontWeight:600, marginBottom:4 }}>✅ {o.delivery_boy_name}</div>}
                    {(() => {
                      const onlineBoys = boys.filter(b => b.is_online)
                      if (!onlineBoys.length) return <span style={{ fontSize:11, color:'var(--rd)' }}>⚫ Koi Online Nahi</span>
                      return <select className={styles.statSel} onChange={e => e.target.value && assignBoy(o.id, e.target.value)} value="">
                        <option value="">{o.delivery_boy_name ? '↺ Change' : 'Assign'}</option>
                        {onlineBoys.map(b => <option key={b.id} value={b.id}>🟢 {b.name}</option>)}
                      </select>
                    })()}
                  </div>
                </div>
              )})}
              {filteredOrders.length === 0 && <div style={{ padding:'24px', textAlign:'center', color:'var(--t2)' }}>Koi order nahi mila</div>}
            </div>
            </div>
          </>
          )
        })()}

        {/* ── MENU ── */}
        {section === 'menu' && (
          <>
            <div className={styles.sectionHead}><h2>Menu Items</h2><button className="btn btn-primary" onClick={() => setShowAddItem(true)}>+ Add Item</button></div>
            <div className={styles.menuGrid}>
              {menuItems.map(item => (
                <div key={item.id} className={styles.menuCard}>
                  {/* Photo area */}
                  <div style={{ position:'relative', width:'100%', height:100, borderRadius:8, marginBottom:8, background:'var(--bg)', overflow:'hidden', cursor:'pointer' }}
                    onClick={() => document.getElementById(`img-${item.id}`).click()}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--t3)', fontSize:11 }}>
                          <span style={{ fontSize:24, marginBottom:4 }}>📷</span>
                          Click to add photo
                        </div>
                    }
                    <div style={{ position:'absolute', bottom:4, right:4, background:'#0007', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:10 }}>
                      {uploadingImg && editingItemId===item.id ? '⏳' : '📷 Change'}
                    </div>
                    <input type="file" id={`img-${item.id}`} accept="image/jpeg,image/png,image/webp" style={{ display:'none' }}
                      onChange={e => { if(e.target.files[0]) { setEditingItemId(item.id); uploadImage(e.target.files[0], url => updateMenuItemImage(item.id, url)) } }} />
                  </div>

                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4, flexWrap:'wrap' }}>
                    <span className={`veg-dot ${item.is_veg?'veg':'nonveg'}`} />
                    <strong style={{ fontSize:12 }}>{item.name}</strong>
                    {item.stock_count !== null && item.stock_count !== undefined && parseInt(item.stock_count) <= 5 && (
                      <span style={{ background:'#fef2f2', color:'#dc2626', borderRadius:6, padding:'1px 6px', fontSize:10, fontWeight:700 }}>⚠️ {item.stock_count}</span>
                    )}
                  </div>
                  <span className={styles.catTag}>{item.category}</span>
                  <div className={styles.priceEdit}>
                    <label style={{ fontSize:11, color:'var(--t2)' }}>₹ Price</label>
                    <input type="number" defaultValue={item.price} className={styles.priceInput} id={`price-${item.id}`} />
                    <label style={{ fontSize:11, color:'var(--t2)' }}>Disc%</label>
                    <input type="number" defaultValue={item.discount_percent} className={styles.priceInput} id={`disc-${item.id}`} />
                    <label style={{ fontSize:11, color:'var(--t2)' }}>Stock</label>
                    <input type="number" min="0" defaultValue={item.stock_count??''} placeholder="∞" className={styles.priceInput} id={`stock-${item.id}`} />
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize:11, padding:'4px 10px', marginBottom:8, width:'100%' }} onClick={async () => {
                    const stockRaw = document.getElementById(`stock-${item.id}`).value
                    await fetch('/api/menu', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:item.id, stock_count: stockRaw===''?null:parseInt(stockRaw) }) })
                    updateItemPrice(item.id, document.getElementById(`price-${item.id}`).value, document.getElementById(`disc-${item.id}`).value)
                  }}>Save</button>
                  <div className={styles.availToggle}>
                    <div className={`switch ${item.is_available?'on':''}`} onClick={() => toggleMenuItem(item.id, !item.is_available)} />
                    <span style={{ fontSize:12, color:'var(--t2)' }}>{item.is_available?'Available':'Unavailable'}</span>
                  </div>
                </div>
              ))}
            </div>
            {showAddItem && (
              <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowAddItem(false)}>
                <div className={styles.modal}>
                  <h3>Add New Item</h3>
                  <form onSubmit={addNewItem}>
                    <div className="field"><label>Item Name</label><input required value={newItem.name} onChange={e => setNewItem({...newItem, name:e.target.value})} /></div>
                    <div className="field"><label>Description</label><input value={newItem.description} onChange={e => setNewItem({...newItem, description:e.target.value})} /></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div className="field"><label>Price (₹)</label><input required type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price:e.target.value})} /></div>
                      <div className="field"><label>Discount %</label><input type="number" value={newItem.discount_percent} onChange={e => setNewItem({...newItem, discount_percent:e.target.value})} /></div>
                    </div>
                    <div className="field"><label>Category</label><select value={newItem.category} onChange={e => setNewItem({...newItem, category:e.target.value})}><option>Rice Combos</option><option>Fried Rice Combos</option><option>Roti &amp; Puri Combos</option><option>Add-Ons</option></select></div>
                    <div className="field">
                      <label>Photo (optional)</label>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        {newItem.image_url && <img src={newItem.image_url} style={{ width:60, height:45, objectFit:'cover', borderRadius:6 }} />}
                        <label style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'var(--bg)', border:'1px dashed var(--bdr)', borderRadius:8, cursor:'pointer', fontSize:12 }}>
                          📷 {uploadingImg ? 'Uploading...' : 'Choose Photo (JPEG)'}
                          <input type="file" accept="image/jpeg,image/png" style={{ display:'none' }} disabled={uploadingImg}
                            onChange={e => { if(e.target.files[0]) uploadImage(e.target.files[0], url => setNewItem(ni => ({...ni, image_url:url}))) }} />
                        </label>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowAddItem(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={uploadingImg}>Add Item</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── OFFERS ── */}
        {section === 'offers' && (
          <>
            <div className={styles.sectionHead}><h2>Active Offers</h2><button className="btn btn-primary" onClick={() => setShowAddOffer(true)}>+ New Offer</button></div>
            <div className={styles.offerGrid}>
              {offers.map(o => (
                <div key={o.id} className={styles.offerCard}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <strong style={{ fontSize:16, color:'var(--or)' }}>{o.code}</strong>
                    <span className={`badge ${o.is_active?'badge-done':'badge-cancelled'}`}>{o.is_active?'Active':'Inactive'}</span>
                  </div>
                  <p style={{ fontSize:12, color:'var(--t2)', marginBottom:6 }}>{o.type==='flat'?`₹${o.value} off`:o.type==='percent'?`${o.value}% off`:'Free delivery'} · Min ₹{o.min_order}</p>
                  <p style={{ fontSize:11, color:'var(--t3)' }}>Used {o.used_count}/{o.max_uses} times</p>
                  <div style={{ display:'flex', gap:6, marginTop:10 }}>
                    <button className="btn btn-secondary" style={{ flex:1, fontSize:11, padding:'5px 8px' }}
                      onClick={async () => { await fetch('/api/admin',{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'offer',id:o.id,is_active:!o.is_active}) }); await loadAll() }}>
                      {o.is_active?'Disable':'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {showAddOffer && (
              <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowAddOffer(false)}>
                <div className={styles.modal}>
                  <h3>Create Offer</h3>
                  <form onSubmit={addNewOffer}>
                    <div className="field"><label>Offer Code</label><input required value={newOffer.code} onChange={e => setNewOffer({...newOffer, code:e.target.value.toUpperCase()})} placeholder="SAVE50" /></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div className="field"><label>Type</label><select value={newOffer.type} onChange={e => setNewOffer({...newOffer, type:e.target.value})}><option value="percent">% Discount</option><option value="flat">Flat Discount</option><option value="free_delivery">Free Delivery</option></select></div>
                      <div className="field"><label>Value</label><input required type="number" value={newOffer.value} onChange={e => setNewOffer({...newOffer, value:e.target.value})} /></div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div className="field"><label>Min Order ₹</label><input type="number" value={newOffer.min_order} onChange={e => setNewOffer({...newOffer, min_order:e.target.value})} /></div>
                      <div className="field"><label>Max Uses</label><input type="number" value={newOffer.max_uses} onChange={e => setNewOffer({...newOffer, max_uses:e.target.value})} /></div>
                    </div>
                    <div className="field"><label>Valid Till</label><input type="date" value={newOffer.valid_till} onChange={e => setNewOffer({...newOffer, valid_till:e.target.value})} /></div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowAddOffer(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex:1 }}>Launch Offer</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DELIVERY BOYS ── */}
        {section === 'boys' && (
          <>
            <div className={styles.sectionHead}>
              <h2>Delivery Boys</h2>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:12, padding:'4px 10px', borderRadius:12, background:'#dcfce7', color:'#16a34a', fontWeight:600 }}>🟢 {boys.filter(b=>b.is_online).length} Online</span>
                <span style={{ fontSize:12, padding:'4px 10px', borderRadius:12, background:'#fee2e2', color:'#dc2626', fontWeight:600 }}>⚫ {boys.filter(b=>!b.is_online).length} Offline</span>
              </div>
            </div>
            {/* Summary cards */}
            <div className={styles.statsRow} style={{ marginBottom:16 }}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Earnings (All)</div>
                <div className={styles.statVal} style={{color:'var(--gr-d)'}}>₹{Math.round(boys.reduce((a,b)=>a+parseFloat(b.total_earnings||0),0))}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Paid (All)</div>
                <div className={styles.statVal} style={{color:'var(--bl)'}}>₹{Math.round(boys.reduce((a,b)=>a+parseFloat(b.total_paid||0),0))}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Payment Due</div>
                <div className={styles.statVal} style={{color:'var(--rd)'}}>₹{Math.round(boys.reduce((a,b)=>a+parseFloat(b.payment_due||0),0))}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Online Now</div>
                <div className={styles.statVal} style={{color:'var(--gr-d)'}}>🟢 {boys.filter(b=>b.is_online).length}</div>
              </div>
            </div>

            <div className={styles.table}>
              <div className={`${styles.tHead}`} style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                <span>Name</span><span>Phone</span><span>Vehicle</span><span>Total Earned</span><span>Total Paid</span><span>💳 Due</span><span>Actions</span>
              </div>
              {boys.map(b => {
                const due = parseFloat(b.payment_due || 0)
                return (
                  <div key={b.id} className={`${styles.tRow}`} style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div className={styles.boyAvatar}>{b.name.split(' ').map(n=>n[0]).join('')}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{b.name}</div>
                        <div style={{ fontSize:11, color:'var(--t2)' }}>{b.is_online?'🟢':'⚫'} {b.email}</div>
                      </div>
                    </div>
                    <span style={{ fontSize:12, color:'var(--t2)' }}>{b.phone}</span>
                    <span style={{ fontSize:12 }}>{b.vehicle_number}<br/><span style={{ color:'var(--t3)', fontSize:10 }}>{b.vehicle_type}</span></span>
                    <span style={{ fontWeight:600, color:'var(--gr-d)', fontSize:13 }}>₹{Math.round(parseFloat(b.total_earnings||0))}</span>
                    <span style={{ fontWeight:600, color:'var(--bl)', fontSize:13 }}>₹{Math.round(parseFloat(b.total_paid||0))}</span>
                    <span style={{ fontWeight:700, color: due > 0 ? 'var(--rd)' : 'var(--t3)', fontSize:13 }}>
                      {due > 0 ? `₹${Math.round(due)}` : '—'}
                    </span>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <button className="btn btn-secondary" style={{ fontSize:10, padding:'3px 8px' }} onClick={() => openBoyDetail(b)}>👁 Details</button>
                      <button className="btn btn-secondary" style={{ fontSize:10, padding:'3px 8px', background:'#fef9c3', color:'#854d0e', border:'1px solid #fde047' }} onClick={() => openPayoutModal(b)}>💰 Payout</button>
                      {due > 0 && <button className="btn btn-primary" style={{ fontSize:10, padding:'3px 8px', background:'#16a34a', border:'none' }} onClick={() => openPayModal(b)}>💳 Pay</button>}
                      <button className="btn btn-secondary" style={{ fontSize:10, padding:'3px 8px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5' }}
                        onClick={() => suspendBoy(b.id)}>🚫 Suspend</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── APPLICATIONS ── */}
        {section === 'apps' && (
          <>
            <div className={styles.sectionHead}><h2>Delivery Boy Applications</h2><span style={{ fontSize:12, color:'var(--t2)' }}>{pendingBoys.length} pending</span></div>
            {pendingBoys.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'var(--t2)' }}>✅ Koi pending application nahi hai</div>
            ) : (
              pendingBoys.map(b => (
                <div key={b.id} style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', marginBottom:12, border:'1.5px solid var(--bdr)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:16, fontWeight:700 }}>{b.name}</div>
                      <div style={{ fontSize:12, color:'var(--t2)', marginTop:2 }}>Applied: {new Date(b.created_at).toLocaleDateString('en-IN')}</div>
                    </div>
                    <span className="badge badge-new">Pending</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'8px 16px', fontSize:12, color:'var(--t1)', marginBottom:14 }}>
                    <div><span style={{ color:'var(--t2)' }}>📧 Email: </span>{b.email}</div>
                    <div><span style={{ color:'var(--t2)' }}>📱 Phone: </span>{b.phone}</div>
                    <div><span style={{ color:'var(--t2)' }}>🛵 Vehicle: </span>{b.vehicle_number} ({b.vehicle_type})</div>
                    <div><span style={{ color:'var(--t2)' }}>🪪 License: </span>{b.license_number || '—'}</div>
                    <div><span style={{ color:'var(--t2)' }}>🆔 Aadhar: </span>{b.aadhar_number || '—'}</div>
                    <div><span style={{ color:'var(--t2)' }}>🎂 DOB: </span>{b.date_of_birth ? new Date(b.date_of_birth).toLocaleDateString('en-IN') : '—'}</div>
                    <div><span style={{ color:'var(--t2)' }}>🆘 Emergency: </span>{b.emergency_contact || '—'}</div>
                    <div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--t2)' }}>🏠 Address: </span>{b.home_address || '—'}</div>
                  </div>
                  <div style={{ display:'flex', gap:10 }}>
                    <button className="btn btn-primary" style={{ flex:1 }} onClick={() => approveDeliveryBoy(b.id)}>✅ Approve</button>
                    <button className="btn btn-secondary" style={{ flex:1, color:'var(--rd)', borderColor:'#fca5a5' }} onClick={() => rejectDeliveryBoy(b.id)}>❌ Reject</button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── KITCHEN SETTINGS ── */}
        {section === 'kitchen' && (
          <>
            <div className={styles.sectionHead}><h2>⚙️ Kitchen Settings</h2><button className="btn btn-primary" onClick={saveKitchenSettings}>💾 Save All</button></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1px solid var(--bdr)', gridColumn:'1/-1' }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>🏠 Basic Info</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field"><label>Kitchen Name</label><input value={kitchenSettings.kitchen_name} onChange={e => setKitchenSettings({...kitchenSettings, kitchen_name:e.target.value})} placeholder="FoodFi Cloud Kitchen" /></div>
                  <div className="field"><label>Phone Number</label><input value={kitchenSettings.phone} onChange={e => setKitchenSettings({...kitchenSettings, phone:e.target.value})} placeholder="+91 75469 83536" /></div>
                </div>
                <div className="field"><label>Address</label><input value={kitchenSettings.address} onChange={e => setKitchenSettings({...kitchenSettings, address:e.target.value})} placeholder="Road No 8, East Laxmi Nagar, Patna" /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field"><label>Latitude</label><input type="number" step="any" value={kitchenSettings.lat} onChange={e => setKitchenSettings({...kitchenSettings, lat:e.target.value})} placeholder="25.5801392" /></div>
                  <div className="field"><label>Longitude</label><input type="number" step="any" value={kitchenSettings.lng} onChange={e => setKitchenSettings({...kitchenSettings, lng:e.target.value})} placeholder="85.1569214" /></div>
                </div>
              </div>

              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1px solid var(--bdr)' }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>🚴 Delivery Settings</h3>
                <div className="field">
                  <label>Max Delivery Radius (km)</label>
                  <input type="number" value={kitchenSettings.max_delivery_km} onChange={e => setKitchenSettings({...kitchenSettings, max_delivery_km:e.target.value})} />
                  <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Is radius se bahar ke customers order nahi kar payenge</p>
                </div>
                <div className="field">
                  <label>Estimated Delivery Time (min)</label>
                  <input type="number" value={kitchenSettings.estimated_time} onChange={e => setKitchenSettings({...kitchenSettings, estimated_time:e.target.value})} />
                </div>
              </div>

              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1px solid var(--bdr)' }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>⏰ Kitchen Timing</h3>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div className={`switch ${kitchenSettings.auto_schedule?'on':''}`} onClick={() => setKitchenSettings({...kitchenSettings, auto_schedule:!kitchenSettings.auto_schedule})} />
                  <span style={{ fontSize:13 }}>Auto Open/Close by Time</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field"><label>Open Time</label><input type="time" value={kitchenSettings.open_time} onChange={e => setKitchenSettings({...kitchenSettings, open_time:e.target.value})} /></div>
                  <div className="field"><label>Close Time</label><input type="time" value={kitchenSettings.close_time} onChange={e => setKitchenSettings({...kitchenSettings, close_time:e.target.value})} /></div>
                </div>
                {kitchenSettings.auto_schedule && <p style={{ fontSize:11, color:'var(--gr-d)', marginTop:4 }}>✅ Kitchen {kitchenSettings.open_time} – {kitchenSettings.close_time} ke beech auto-open rahega</p>}
              </div>

              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1.5px solid #fbbf24', gridColumn:'1/-1' }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>🚨 Order Alert Timing</h3>
                <p style={{ fontSize:11, color:'var(--t2)', marginBottom:14 }}>Agar admin ne order accept nahi kiya to system urgent alarm bajayega. Yahan se timings set karo.</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field">
                    <label>Order Timeout (minutes)</label>
                    <input type="number" min="1" max="30" value={kitchenSettings.order_timeout_minutes} onChange={e => setKitchenSettings({...kitchenSettings, order_timeout_minutes:e.target.value})} />
                    <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Order aane ke X minute baad accept na ho tab urgent alarm bajega</p>
                  </div>
                  <div className="field">
                    <label>Escalation Repeat (seconds)</label>
                    <input type="number" min="10" max="300" value={kitchenSettings.escalation_interval_sec} onChange={e => setKitchenSettings({...kitchenSettings, escalation_interval_sec:e.target.value})} />
                    <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Har X seconds baad alarm repeat hoga jab tak order accept na ho</p>
                  </div>
                </div>
                <p style={{ fontSize:11, color:'#92400e', background:'#fef3c7', borderRadius:8, padding:'8px 12px', margin:0 }}>
                  💡 Save karne ke baad naye timings turant apply ho jayenge. Default: 2 min timeout, 30 sec repeat.
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── KM PRICING ── */}
        {section === 'pricing' && (
          <>
            <div className={styles.sectionHead}><h2>Delivery Pricing</h2><button className="btn btn-primary" onClick={savePricing}>Save Changes</button></div>
            <div className={styles.table}>
              <div className={`${styles.tHead}`} style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr' }}><span>Range</span><span>Min KM</span><span>Base Charge (₹)</span><span>Per Extra KM (₹)</span></div>
              {pricing.map((row, i) => (
                <div key={row.id} className={styles.tRow} style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr' }}>
                  <span style={{ fontWeight:500, fontSize:12 }}>{row.min_km} – {row.max_km??'∞'} km</span>
                  <span style={{ fontSize:12, color:'var(--t2)' }}>{row.min_km} km</span>
                  <input type="number" defaultValue={row.base_charge} className={styles.priceInput} onChange={e => { const p=[...pricing]; p[i]={...p[i],base_charge:e.target.value}; setPricing(p) }} />
                  <input type="number" defaultValue={row.per_km_charge} className={styles.priceInput} onChange={e => { const p=[...pricing]; p[i]={...p[i],per_km_charge:e.target.value}; setPricing(p) }} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CUSTOMERS ── */}
        {section === 'customers' && (
          <>
            <div className={styles.sectionHead}><h2>Customers</h2><span style={{ fontSize:12, color:'var(--t2)' }}>{customers.length} registered</span></div>
            <div className={styles.table}>
              <div className={`${styles.tHead}`} style={{ gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 1.5fr' }}><span>Name</span><span>Phone</span><span>Orders</span><span>Total Spent</span><span>Joined</span><span>Last Order</span></div>
              {customers.map(c => (
                <div key={c.id} className={`${styles.tRow}`} style={{ gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 1.5fr' }}>
                  <div><div style={{ fontWeight:500, fontSize:13 }}>{c.name}</div><div style={{ fontSize:11, color:'var(--t2)' }}>{c.email}</div></div>
                  <span style={{ fontSize:12, color:'var(--t2)' }}>{c.phone||'—'}</span>
                  <span style={{ fontWeight:600, color:'var(--bl)' }}>{c.total_orders}</span>
                  <span style={{ fontWeight:600, color:'var(--gr-d)' }}>₹{Math.round(c.total_spent)}</span>
                  <span style={{ fontSize:11, color:'var(--t2)' }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                  <span style={{ fontSize:11, color:'var(--t2)' }}>{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('en-IN') : '—'}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── SUPPORT CHAT ── */}
        {section === 'support' && (
          <div style={{ display:'flex', gap:16, height:'calc(100vh - 200px)' }}>
            {/* Thread list */}
            <div style={{ width:240, background:'var(--card)', borderRadius:14, border:'1px solid var(--bdr)', overflowY:'auto', flexShrink:0 }}>
              <div style={{ padding:'12px 14px', fontWeight:700, fontSize:14, borderBottom:'1px solid var(--bdr)' }}>
                💬 Customer Chats
              </div>
              {supportThreads.length === 0 && <div style={{ padding:20, fontSize:13, color:'var(--t2)', textAlign:'center' }}>No messages yet</div>}
              {supportThreads.map(t => (
                <div key={t.user_id}
                  onClick={() => loadChat(t.user_id)}
                  style={{ padding:'12px 14px', borderBottom:'1px solid var(--bg)', cursor:'pointer',
                    background: activeChatUser===t.user_id ? 'var(--bg)' : 'transparent' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontWeight:600, fontSize:13 }}>{t.user_name}</span>
                    {parseInt(t.unread_count)>0 && <span style={{ background:'var(--or)', color:'#fff', borderRadius:10, padding:'0 6px', fontSize:11 }}>{t.unread_count}</span>}
                  </div>
                  <div style={{ fontSize:11, color:'var(--t2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.message}</div>
                  <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>{t.user_phone}</div>
                </div>
              ))}
            </div>

            {/* Chat area */}
            <div style={{ flex:1, background:'var(--card)', borderRadius:14, border:'1px solid var(--bdr)', display:'flex', flexDirection:'column' }}>
              {!activeChatUser ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--t2)', fontSize:14 }}>
                  ← Select a customer to view chat
                </div>
              ) : (
                <>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)', fontWeight:600, fontSize:14 }}>
                    Chat with {supportThreads.find(t => t.user_id === activeChatUser)?.user_name}
                    <span style={{ fontSize:11, color:'var(--t2)', marginLeft:8 }}>{supportThreads.find(t => t.user_id === activeChatUser)?.user_phone}</span>
                  </div>
                  <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                    {chatMessages.map(m => (
                      <div key={m.id} style={{ display:'flex', justifyContent: m.is_from_admin ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth:'75%', background: m.is_from_admin ? 'var(--or)' : 'var(--bg)',
                          color: m.is_from_admin ? '#fff' : 'var(--t1)',
                          borderRadius: m.is_from_admin ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          padding:'8px 12px', fontSize:13 }}>
                          {m.message}
                          <div style={{ fontSize:10, opacity:0.7, marginTop:4 }}>{new Date(m.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:'12px 16px', borderTop:'1px solid var(--bdr)', display:'flex', gap:8 }}>
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && sendAdminReply()}
                      placeholder="Type reply..." style={{ flex:1, padding:'10px 12px', borderRadius:8, border:'1px solid var(--bdr)', fontSize:13 }} />
                    <button className="btn btn-primary" onClick={sendAdminReply}>Send</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {section === 'analytics' && analytics && (() => {
          const chart = analytics.revenueChart || []
          const maxRev = Math.max(...chart.map(d => parseFloat(d.revenue)), 1)
          return (
          <>
            <div className={styles.sectionHead}>
              <h2>📊 Analytics</h2>
              <button className="btn btn-secondary" style={{fontSize:12}} onClick={() => window.open('/api/orders?format=csv')}>
                ⬇️ Export CSV
              </button>
            </div>

            {/* Summary cards */}
            <div className={styles.statsRow}>
              {[
                ['Orders (7d)', analytics.weekStats?.week_orders??'-'],
                ['Revenue (7d)', `₹${Math.round(analytics.weekStats?.week_revenue??0)}`],
                ['Avg Order', `₹${Math.round((analytics.weekStats?.week_revenue??0)/Math.max(1,analytics.weekStats?.week_orders??1))}`],
                ['Customers', analytics.customerCount??'-'],
              ].map(([label,val]) => (
                <div key={label} className={styles.statCard}>
                  <div className={styles.statLabel}>{label}</div>
                  <div className={styles.statVal}>{val}</div>
                </div>
              ))}
            </div>

            {/* Revenue Bar Chart — last 7 days */}
            <div style={{ background:'var(--card)', borderRadius:16, padding:'20px 24px', border:'1px solid var(--bd)', marginBottom:16 }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16, color:'var(--t1)' }}>📈 Last 7 Days Revenue</h3>
              {chart.length === 0 ? (
                <p style={{ color:'var(--t2)', fontSize:13 }}>Koi data nahi</p>
              ) : (
                <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:140 }}>
                  {chart.map((d,i) => {
                    const h = Math.round((parseFloat(d.revenue)/maxRev)*110)
                    return (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <span style={{ fontSize:10, color:'var(--t2)', fontWeight:600 }}>₹{Math.round(parseFloat(d.revenue)/1000)}k</span>
                        <div title={`₹${Math.round(parseFloat(d.revenue))}`}
                          style={{ width:'100%', height:h||4, background:'linear-gradient(180deg,#ff8c42,#e85d04)', borderRadius:'6px 6px 2px 2px', transition:'height 0.4s', minHeight:4 }} />
                        <span style={{ fontSize:9, color:'var(--t2)', textAlign:'center', lineHeight:1.2 }}>{d.day}</span>
                        <span style={{ fontSize:9, color:'var(--t3)' }}>{d.orders}🛒</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top Selling Items */}
            <div style={{ background:'var(--card)', borderRadius:16, padding:'20px 24px', border:'1px solid var(--bd)', marginBottom:16 }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>🏆 Top Selling Items (30 days)</h3>
              {(analytics.topItems||[]).map((item,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--t2)', minWidth:20 }}>#{i+1}</span>
                  <span style={{ fontSize:13, minWidth:140, color:'var(--t1)' }}>{item.name}</span>
                  <div style={{ flex:1, background:'var(--bg)', borderRadius:6, height:10, overflow:'hidden' }}>
                    <div style={{ width:`${Math.round(parseFloat(item.total_qty)/(parseFloat(analytics.topItems[0]?.total_qty)||1)*100)}%`, height:'100%', background:'linear-gradient(90deg,#ff8c42,#e85d04)', borderRadius:6, transition:'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize:12, color:'var(--t2)', minWidth:60, textAlign:'right' }}>
                    {item.total_qty} pcs · ₹{Math.round(parseFloat(item.total_revenue||0))}
                  </span>
                </div>
              ))}
            </div>

            {/* Google Maps API Usage */}
            {apiUsage && !apiUsage.error && (() => {
              const usedPct = Math.min(100, (apiUsage.monthCost / apiUsage.freeCredit) * 100)
              const remaining = Math.max(0, apiUsage.freeCredit - apiUsage.monthCost)
              const barColor = usedPct > 80 ? '#dc2626' : usedPct > 50 ? '#f59e0b' : '#16a34a'
              return (
                <div style={{ background:'var(--card)', borderRadius:16, padding:'20px 24px', border:'1px solid var(--bd)', marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>🗺️ Google Maps API Credit Usage</h3>
                    <span style={{ fontSize:11, color:'var(--t2)', background:'var(--bg)', borderRadius:8, padding:'3px 10px' }}>This Month</span>
                  </div>

                  {/* Credit bar */}
                  <div style={{ marginBottom:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                      <span style={{ color:'var(--t2)' }}>Free Credit Used</span>
                      <span style={{ fontWeight:700, color: barColor }}>${apiUsage.monthCost.toFixed(3)} / $200</span>
                    </div>
                    <div style={{ background:'var(--bg)', borderRadius:8, height:12, overflow:'hidden' }}>
                      <div style={{ width:`${usedPct}%`, height:'100%', background:`linear-gradient(90deg, #16a34a, ${barColor})`, borderRadius:8, transition:'width 0.5s' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginTop:4, color:'var(--t2)' }}>
                      <span>₹{Math.round(apiUsage.monthCost * 83)} (~INR)</span>
                      <span style={{ color: remaining < 10 ? '#dc2626' : '#16a34a' }}>Remaining: ${remaining.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Today vs Month table */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
                    {[
                      { label:'🌐 Map Loads', key:'maps', price:'$0.007' },
                      { label:'📍 Geocoding', key:'geocoding', price:'$0.005' },
                      { label:'🔍 Autocomplete', key:'places', price:'$0.00283' },
                    ].map(({ label, key, price }) => (
                      <div key={key} style={{ background:'var(--bg)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                        <div style={{ fontSize:11, color:'var(--t2)', marginBottom:4 }}>{label}</div>
                        <div style={{ fontSize:18, fontWeight:700, color:'var(--t1)' }}>{(apiUsage.today[key]||0)}</div>
                        <div style={{ fontSize:10, color:'var(--t2)' }}>today</div>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--or)', marginTop:4 }}>{apiUsage.month[key]||0}</div>
                        <div style={{ fontSize:10, color:'var(--t2)' }}>this month</div>
                        <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>{price}/call</div>
                      </div>
                    ))}
                  </div>

                  {/* Tips */}
                  <div style={{ background: usedPct > 70 ? '#fef2f2' : '#f0fdf4', border:`1px solid ${usedPct>70?'#fca5a5':'#86efac'}`, borderRadius:10, padding:'10px 14px', fontSize:12, color: usedPct>70?'#dc2626':'#15803d', lineHeight:1.6 }}>
                    {usedPct > 70
                      ? `⚠️ API usage ${usedPct.toFixed(0)}% ho gayi — consider karo: map picker sirf delivery ke waqt load karo, GPS use karo zyada, reverse geocoding kam karo.`
                      : `✅ Sab theek hai — ${(100-usedPct).toFixed(0)}% free credit bacha hai. Normal usage me mahine bhar free rahega.`}
                  </div>
                </div>
              )
            })()}
          </>
        )})()}
        {/* ── NOTICES ── */}
        {section === 'notices' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>📣 Customer Notices</h2>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 20 }}>Yahan likhi baatein sabhi customers ke profile page pe dikhegi. Attractive messages likho jisse customer connection acha ho!</p>

            {/* Add notice form */}
            <div style={{ background: 'var(--card)', borderRadius: 14, padding: 20, border: '1px solid var(--bd)', marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>✍️ Naya Notice Likho</h3>
              <form onSubmit={addNotice}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>Emoji Select Karo</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {noticeEmojis.map(em => (
                      <button key={em} type="button" onClick={() => setNewNotice(p => ({ ...p, emoji: em }))}
                        style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${newNotice.emoji === em ? 'var(--or)' : 'var(--bd)'}`, background: newNotice.emoji === em ? '#fff7ed' : 'var(--bg)', fontSize: 20, cursor: 'pointer' }}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>Message</label>
                  <textarea required rows={3} value={newNotice.message} onChange={e => setNewNotice(p => ({ ...p, message: e.target.value }))}
                    placeholder="e.g. 🎉 Aaj special offer hai! Sab orders pe 10% extra discount. Thank you for your love! ❤️"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--bd)', background: 'var(--bg)', fontSize: 14, resize: 'none', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" className="btn btn-primary">📣 Post Notice</button>
              </form>
            </div>

            {/* Preview */}
            {newNotice.message && (
              <div style={{ background: 'linear-gradient(135deg, #fff7ed, #fef3c7)', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{newNotice.emoji}</span>
                <div>
                  <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginBottom: 3 }}>Preview (customer ko aisa dikhega):</div>
                  <span style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>{newNotice.message}</span>
                </div>
              </div>
            )}

            {/* Existing notices */}
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Posted Notices ({notices.length})</h3>
            {notices.length === 0 && <p style={{ color: 'var(--t2)', fontSize: 13 }}>Abhi koi notice nahi hai</p>}
            {notices.map(n => (
              <div key={n.id} style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, border: '1px solid var(--bd)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, marginTop: 2 }}>{n.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.5, color: 'var(--t1)' }}>{n.message}</p>
                  <div style={{ fontSize: 11, color: 'var(--t2)' }}>{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 36, height: 20, borderRadius: 10, background: n.is_active ? 'var(--gr-d)' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                      onClick={() => toggleNotice(n.id, !n.is_active)}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: n.is_active ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px #0002' }} />
                    </div>
                    <span style={{ fontSize: 11, color: n.is_active ? 'var(--gr-d)' : 'var(--t2)', fontWeight: 600 }}>{n.is_active ? 'Live' : 'Off'}</span>
                  </div>
                  <button onClick={() => deleteNotice(n.id)} style={{ background: '#fef2f2', color: 'var(--rd)', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── BROADCAST ─────────────────────────────────────────── */}
        {section === 'broadcast' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>📢 Broadcast Notification</h2>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 24 }}>
              Customers ya Delivery Boys ko seedha notification bhejo — phone pe baj ke aayegi!
            </p>

            {/* Target selector */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { value: 'customer', label: '🧑‍💼 Sab Customers', color: '#e85d04', bg: '#fff7ed' },
                { value: 'delivery', label: '🛵 Sab Delivery Boys', color: '#16a34a', bg: '#f0fdf4' },
                { value: 'all',      label: '🌐 Sabko (All)',      color: '#3b82f6', bg: '#eff6ff' },
              ].map(t => (
                <button key={t.value}
                  onClick={() => setBroadcastForm(p => ({ ...p, target: t.value }))}
                  style={{
                    padding: '10px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    border: `2px solid ${broadcastForm.target === t.value ? t.color : 'var(--bd)'}`,
                    background: broadcastForm.target === t.value ? t.bg : 'var(--card)',
                    color: broadcastForm.target === t.value ? t.color : 'var(--t2)',
                    transition: 'all 0.15s'
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Form */}
            <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, border: '1px solid var(--bd)', marginBottom: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>
                  📝 Notification Title *
                </label>
                <input
                  value={broadcastForm.title}
                  onChange={e => setBroadcastForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. 🎉 Special Offer Today!"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--bd)', background: 'var(--bg)', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>
                  💬 Message *
                </label>
                <textarea
                  rows={3}
                  value={broadcastForm.body}
                  onChange={e => setBroadcastForm(p => ({ ...p, body: e.target.value }))}
                  placeholder="e.g. Aaj sab orders pe FREE delivery! Jaldi karo — limited time 🔥"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--bd)', background: 'var(--bg)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>
                  🔗 Click karne pe kahan jaaye? (optional)
                </label>
                <select
                  value={broadcastForm.url}
                  onChange={e => setBroadcastForm(p => ({ ...p, url: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--bd)', background: 'var(--bg)', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }}>
                  <option value="">/ (Home)</option>
                  <option value="/menu">🍽️ Menu</option>
                  <option value="/orders">📦 My Orders</option>
                  <option value="/delivery">🛵 Delivery App</option>
                </select>
              </div>

              {/* Preview */}
              {broadcastForm.title && (
                <div style={{ background: '#1e293b', borderRadius: 14, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <img src="/icons/icon-192.png" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} alt="" />
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>FoodFi · Preview</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{broadcastForm.title}</div>
                    <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>{broadcastForm.body || '...'}</div>
                  </div>
                </div>
              )}

              <button
                disabled={!broadcastForm.title || !broadcastForm.body || broadcastSending}
                onClick={async () => {
                  setBroadcastSending(true)
                  setBroadcastResult(null)
                  try {
                    const res = await fetch('/api/push/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        role: broadcastForm.target,
                        title: broadcastForm.title,
                        body: broadcastForm.body,
                        url: broadcastForm.url || '/',
                        tag: `broadcast-${Date.now()}`,
                        requireInteraction: false,
                      })
                    })
                    const data = await res.json()
                    setBroadcastResult(data)
                    if (data.ok) setBroadcastForm(p => ({ ...p, title: '', body: '' }))
                  } catch (e) {
                    setBroadcastResult({ error: e.message })
                  } finally {
                    setBroadcastSending(false)
                  }
                }}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: (!broadcastForm.title || !broadcastForm.body || broadcastSending) ? '#d1d5db' : '#e85d04',
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: (!broadcastForm.title || !broadcastForm.body || broadcastSending) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}>
                {broadcastSending ? '📡 Bhej raha hoon...' : `📢 Bhejo — ${broadcastForm.target === 'customer' ? 'Sab Customers' : broadcastForm.target === 'delivery' ? 'Sab Delivery Boys' : 'Sabko'}`}
              </button>
            </div>

            {/* Result */}
            {broadcastResult && (
              <div style={{
                background: broadcastResult.ok ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${broadcastResult.ok ? '#86efac' : '#fca5a5'}`,
                borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center'
              }}>
                <span style={{ fontSize: 24 }}>{broadcastResult.ok ? '✅' : '❌'}</span>
                <div>
                  {broadcastResult.ok
                    ? <><div style={{ fontWeight: 700, color: '#15803d', fontSize: 14 }}>Notification bhej diya!</div>
                        <div style={{ fontSize: 12, color: '#166534' }}>
                          {broadcastResult.sent} logon ko mili · {broadcastResult.failed || 0} failed
                        </div></>
                    : <div style={{ color: '#dc2626', fontSize: 14 }}>Error: {broadcastResult.error}</div>
                  }
                </div>
              </div>
            )}

            {/* Tips */}
            <div style={{ background: 'var(--card)', borderRadius: 14, padding: 18, border: '1px solid var(--bd)', marginTop: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>💡 Tips</h3>
              {[
                '🔔 Notification tabhi milegi jab customer/delivery boy ne notification allow ki ho',
                '📱 Phone locked hone par bhi notification aayegi aur awaaz bajegi',
                '⚡ "Sab Customers" choose karo offers aur updates ke liye',
                '🛵 "Sab Delivery Boys" choose karo kitchen instructions ke liye',
              ].map((tip, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 8, lineHeight: 1.5 }}>{tip}</div>
              ))}
            </div>
          </div>
        )}
        {/* ── STOCK MANAGEMENT ── */}
        {section === 'stock' && (
          <div>
            <div className={styles.sectionHead}>
              <h2>📦 Stock Management</h2>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn" style={{ background:'#f59e0b', color:'#fff' }} onClick={async () => {
                  if (!confirm('Sab items ka stock default pe reset karein?')) return
                  const r = await fetch('/api/admin?type=stock', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reset_all: true }) })
                  const d = await r.json()
                  if (d.ok) { fetch('/api/admin?type=stock').then(r=>r.json()).then(d=>setStockItems(d.items||[])) }
                }}>🔄 Reset All to Default</button>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, color:'#6b7280' }}>🟢 Stock OK &nbsp; 🟡 Low (≤2) &nbsp; 🔴 Khatam (0)</span>
              <span style={{ fontSize:11, color:'#9ca3af' }}>• Stock null = tracking off (unlimited)</span>
            </div>

            {stockLoading ? (
              <div style={{ textAlign:'center', padding:40 }}><div className="spinner" /></div>
            ) : (() => {
              // scrollable wrapper applied around the whole rendered block (see return below)
              // Sort into 3 priority groups
              const sortByName = (a, b) => a.name.localeCompare(b.name)
              const outOfStock = stockItems.filter(i => i.stock_count !== null && i.stock_count !== undefined && i.stock_count === 0).sort(sortByName)
              const lowStock   = stockItems.filter(i => i.stock_count !== null && i.stock_count !== undefined && i.stock_count > 0 && i.stock_count <= 2).sort(sortByName)
              const available  = stockItems.filter(i => i.stock_count === null || i.stock_count === undefined || i.stock_count > 2).sort(sortByName)

              const renderItem = (item) => {
                const sc = item.stock_count
                const isNull = sc === null || sc === undefined
                const color = isNull ? '#6b7280' : sc === 0 ? '#ef4444' : sc <= 2 ? '#f59e0b' : '#16a34a'
                const bg    = isNull ? '#f9fafb' : sc === 0 ? '#fef2f2' : sc <= 2 ? '#fffbeb' : '#f0fdf4'
                return (
                  <div key={item.id} style={{ background: bg, border:`1.5px solid ${color}33`, borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, flexWrap:'nowrap', minWidth:620 }}>
                    {/* Status dot */}
                    <span style={{ fontSize:16 }}>{isNull ? '⚪' : sc === 0 ? '🔴' : sc <= 2 ? '🟡' : '🟢'}</span>

                    {/* Name + category tag */}
                    <div style={{ flex:1, minWidth:120 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{item.name}</span>
                      <span style={{ fontSize:10, color:'#9ca3af', marginLeft:6 }}>{item.category}</span>
                    </div>

                    {/* Stock count control */}
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11, color:'var(--t3)' }}>Stock:</span>
                      <button style={{ width:28, height:28, borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontWeight:700, fontSize:14 }}
                        onClick={async () => {
                          if (isNull) return
                          const newVal = Math.max(0, sc - 1)
                          await fetch('/api/admin?type=stock', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: item.id, stock_count: newVal }) })
                          setStockItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_count: newVal } : i))
                        }}>−</button>
                      <input type="number" min="0" value={isNull ? '' : sc}
                        placeholder="∞"
                        style={{ width:52, textAlign:'center', border:'1.5px solid #e5e7eb', borderRadius:6, padding:'4px 2px', fontSize:13, fontWeight:700, color: color }}
                        onChange={async (e) => {
                          const val = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0)
                          await fetch('/api/admin?type=stock', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: item.id, stock_count: val }) })
                          setStockItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_count: val } : i))
                        }} />
                      <button style={{ width:28, height:28, borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontWeight:700, fontSize:14 }}
                        onClick={async () => {
                          const newVal = (isNull ? 0 : sc) + 1
                          await fetch('/api/admin?type=stock', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: item.id, stock_count: newVal }) })
                          setStockItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_count: newVal } : i))
                        }}>+</button>
                    </div>

                    {/* Default stock */}
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11, color:'var(--t3)' }}>Default:</span>
                      <input type="number" min="0"
                        value={item.stock_default ?? (item.category?.toLowerCase().includes('rice') ? 10 : 5)}
                        style={{ width:52, textAlign:'center', border:'1.5px solid #e5e7eb', borderRadius:6, padding:'4px 2px', fontSize:12, color:'var(--t2)' }}
                        onChange={async (e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0)
                          await fetch('/api/admin?type=stock', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: item.id, stock_default: val }) })
                          setStockItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_default: val } : i))
                        }} />
                    </div>

                    {/* Reset to default */}
                    <button style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'var(--t2)', whiteSpace:'nowrap' }}
                      onClick={async () => {
                        const defVal = item.stock_default ?? (item.category?.toLowerCase().includes('rice') ? 10 : 5)
                        await fetch('/api/admin?type=stock', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: item.id, stock_count: defVal }) })
                        setStockItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_count: defVal } : i))
                      }}>↺ Reset</button>
                  </div>
                )
              }

              return (
                <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'65vh', paddingBottom:8 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:16, minWidth:640 }}>
                  {/* ── OUT OF STOCK ── */}
                  {outOfStock.length > 0 && (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'6px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8 }}>
                        <span style={{ fontSize:15 }}>🔴</span>
                        <span style={{ fontWeight:700, fontSize:13, color:'#dc2626' }}>Out of Stock</span>
                        <span style={{ fontSize:11, background:'#dc2626', color:'#fff', borderRadius:20, padding:'1px 8px', fontWeight:700 }}>{outOfStock.length}</span>
                        <span style={{ fontSize:11, color:'#ef4444', marginLeft:'auto' }}>⚠️ Order block ho raha hai — jaldi refill karo!</span>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {outOfStock.map(renderItem)}
                      </div>
                    </div>
                  )}

                  {/* ── LOW STOCK ── */}
                  {lowStock.length > 0 && (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'6px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8 }}>
                        <span style={{ fontSize:15 }}>🟡</span>
                        <span style={{ fontWeight:700, fontSize:13, color:'#d97706' }}>Low Stock</span>
                        <span style={{ fontSize:11, background:'#f59e0b', color:'#fff', borderRadius:20, padding:'1px 8px', fontWeight:700 }}>{lowStock.length}</span>
                        <span style={{ fontSize:11, color:'#92400e', marginLeft:'auto' }}>Khatam hone wala hai — refill consider karo</span>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {lowStock.map(renderItem)}
                      </div>
                    </div>
                  )}

                  {/* ── AVAILABLE ── */}
                  {available.length > 0 && (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'6px 12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8 }}>
                        <span style={{ fontSize:15 }}>🟢</span>
                        <span style={{ fontWeight:700, fontSize:13, color:'#16a34a' }}>Available</span>
                        <span style={{ fontSize:11, background:'#16a34a', color:'#fff', borderRadius:20, padding:'1px 8px', fontWeight:700 }}>{available.length}</span>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {available.map(renderItem)}
                      </div>
                    </div>
                  )}
                </div>
                </div>
              )
            })()}

            <div style={{ marginTop:20, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'12px 16px', fontSize:12, color:'#92400e', lineHeight:1.7 }}>
              <strong>📋 Stock Rules:</strong><br />
              • <strong>Stock = null/∞</strong> → Unlimited (tracking off)<br />
              • <strong>Stock = 0</strong> → Item order block ho jayega<br />
              • <strong>Stock ≤ 2</strong> → Low stock notification aayega<br />
              • <strong>Default</strong> → Daily midnight reset pe yahi value set hogi<br />
              • <strong>Rice Combos default: 10 | Baaki sab: 5</strong>
            </div>
          </div>
        )}

        {/* ── RECIPE BOOK ── */}
        {section === 'recipes' && (() => {
          const filteredRecipes = RECIPES.filter(r => {
            const matchCat = recipeCat === 'Sab Recipes' || r.category === recipeCat
            const matchSearch = !recipeSearch || r.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
              r.usedIn?.some(u => u.toLowerCase().includes(recipeSearch.toLowerCase())) ||
              r.description?.toLowerCase().includes(recipeSearch.toLowerCase())
            return matchCat && matchSearch
          })
          return (
            <>
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h2 style={{ fontSize:20, fontWeight:700, color:'var(--t1)' }}>📖 FoodFi Recipe Book</h2>
                  <p style={{ fontSize:12, color:'var(--t2)', marginTop:4 }}>Chef Saif ke liye — Patna/Bihar North Indian Style · Sab quantities per 100g main ingredient</p>
                </div>
                <button
                  onClick={() => printRecipeBook(recipeCat)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'#e85d04', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                  📥 PDF Download karein
                </button>
              </div>

              {/* Search */}
              <input
                type="text" placeholder="🔍 Recipe ya menu item dhundho..."
                value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)}
                style={{ width:'100%', padding:'10px 14px', border:'1px solid var(--bd)', borderRadius:10, fontSize:13, background:'var(--card)', color:'var(--t1)', marginBottom:12, outline:'none' }}
              />

              {/* Category Tabs */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
                {RECIPE_CATEGORIES.map(cat => (
                  <button key={cat}
                    onClick={() => setRecipeCat(cat)}
                    style={{ padding:'5px 14px', borderRadius:20, border:`1.5px solid ${recipeCat===cat?'#e85d04':'var(--bd)'}`, background:recipeCat===cat?'#e85d04':'var(--card)', color:recipeCat===cat?'#fff':'var(--t2)', fontSize:12, cursor:'pointer', fontWeight:recipeCat===cat?700:400, transition:'all 0.15s' }}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Stats */}
              <div style={{ fontSize:11, color:'var(--t2)', marginBottom:14 }}>
                {filteredRecipes.length} recipes dikh rahi hain · {RECIPES.length} total base recipes
              </div>

              {/* Recipe Cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filteredRecipes.map(recipe => {
                  const isExpanded = expandedRecipe === recipe.id
                  const activeTab = recipeTab[recipe.id] || 'ingredients'
                  return (
                    <div key={recipe.id} style={{ background:'var(--card)', border:`1.5px solid ${isExpanded?'#e85d04':'var(--bd)'}`, borderRadius:12, overflow:'hidden', transition:'border 0.2s' }}>
                      {/* Card Header */}
                      <div onClick={() => { setExpandedRecipe(isExpanded ? null : recipe.id); if(!recipeTab[recipe.id]) setRecipeTab(p=>({...p,[recipe.id]:'ingredients'})) }}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', cursor:'pointer' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <span style={{ fontSize:28 }}>{recipe.emoji}</span>
                          <div>
                            <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>{recipe.name}</div>
                            <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:2, flexWrap:'wrap' }}>
                              <span style={{ fontSize:10, background:'#fff7ed', color:'#e85d04', borderRadius:4, padding:'1px 6px' }}>{recipe.category}</span>
                              <span style={{ fontSize:10, color:'var(--t3)' }}>⏱ {recipe.prepTime} · 🔥 {recipe.cookTime}</span>
                              <span style={{ fontSize:10, color:'var(--t3)' }}>🍽 {recipe.batchYield}</span>
                            </div>
                          </div>
                        </div>
                        <span style={{ color:'var(--t2)', fontSize:18, transform:isExpanded?'rotate(180deg)':'none', transition:'transform 0.2s' }}>▼</span>
                      </div>

                      {/* Used In Tags */}
                      {recipe.usedIn?.length > 0 && (
                        <div style={{ padding:'0 16px 10px', display:'flex', gap:4, flexWrap:'wrap' }}>
                          {recipe.usedIn.map(item => (
                            <span key={item} style={{ fontSize:10, background:'var(--bg)', color:'var(--t2)', borderRadius:4, padding:'2px 7px', border:'0.5px solid var(--bd)' }}>{item}</span>
                          ))}
                        </div>
                      )}

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div style={{ borderTop:'1px solid var(--bd)', padding:'0 0 16px' }}>
                          {/* Description */}
                          <p style={{ padding:'12px 16px 8px', fontSize:12, color:'var(--t2)', lineHeight:1.6 }}>{recipe.description}</p>

                          {/* Tab Switcher */}
                          <div style={{ display:'flex', gap:0, padding:'0 16px 12px', borderBottom:'1px solid var(--bd)' }}>
                            {[
                              { id:'ingredients', label:'🛒 Samagri', show: recipe.ingredients?.length > 0 || recipe.spices?.length > 0 },
                              { id:'vidhi', label:'👨‍🍳 Vidhi', show: recipe.steps?.length > 0 },
                              { id:'serving', label:'🍽 Serving & Tips', show: true },
                            ].filter(t => t.show).map((tab, idx, arr) => (
                              <button key={tab.id} onClick={() => setRecipeTab(p=>({...p,[recipe.id]:tab.id}))}
                                style={{ padding:'7px 14px', fontSize:11, fontWeight:activeTab===tab.id?700:400, cursor:'pointer', border:'1px solid var(--bd)', borderRight: idx===arr.length-1?'1px solid var(--bd)':'none', borderRadius: idx===0?'8px 0 0 8px':idx===arr.length-1?'0 8px 8px 0':'0', background:activeTab===tab.id?'#e85d04':'var(--bg)', color:activeTab===tab.id?'#fff':'var(--t2)', transition:'all 0.15s' }}>
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          {/* INGREDIENTS TAB */}
                          {activeTab === 'ingredients' && (
                            <div style={{ padding:'14px 16px' }}>
                              {recipe.ingredients?.length > 0 && (
                                <>
                                  <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--t1)' }}>🛒 Samagri (per 100g main ingredient)</div>
                                  <div style={{ overflowX:'auto', marginBottom:16 }}>
                                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                                      <thead>
                                        <tr style={{ background:'#fff7ed' }}>
                                          <th style={{ padding:'7px 10px', textAlign:'left', color:'#e85d04', fontSize:10, textTransform:'uppercase', letterSpacing:'0.5px' }}>Ingredient</th>
                                          <th style={{ padding:'7px 10px', textAlign:'left', color:'#e85d04', fontSize:10, textTransform:'uppercase', letterSpacing:'0.5px' }}>Matra</th>
                                          <th style={{ padding:'7px 10px', textAlign:'left', color:'#e85d04', fontSize:10, textTransform:'uppercase', letterSpacing:'0.5px' }}>Note</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {recipe.ingredients.map((item, i) => (
                                          <tr key={i} style={{ borderBottom:'1px solid var(--bd)', background: i%2===0?'var(--card)':'var(--bg)' }}>
                                            <td style={{ padding:'6px 10px', fontSize:12 }}>{item.name}</td>
                                            <td style={{ padding:'6px 10px', fontSize:12, fontWeight:700, color:'#e85d04' }}>{item.qty}</td>
                                            <td style={{ padding:'6px 10px', fontSize:11, color:'var(--t2)' }}>{item.note || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </>
                              )}
                              {recipe.spices?.length > 0 && (
                                <>
                                  <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--t1)' }}>🌶 Masale</div>
                                  <div style={{ overflowX:'auto' }}>
                                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                                      <thead>
                                        <tr style={{ background:'#fef3c7' }}>
                                          <th style={{ padding:'7px 10px', textAlign:'left', color:'#d97706', fontSize:10, textTransform:'uppercase' }}>Masala</th>
                                          <th style={{ padding:'7px 10px', textAlign:'left', color:'#d97706', fontSize:10, textTransform:'uppercase' }}>Matra</th>
                                          <th style={{ padding:'7px 10px', textAlign:'left', color:'#d97706', fontSize:10, textTransform:'uppercase' }}>Note</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {recipe.spices.map((item, i) => (
                                          <tr key={i} style={{ borderBottom:'1px solid var(--bd)', background: i%2===0?'var(--card)':'var(--bg)' }}>
                                            <td style={{ padding:'6px 10px', fontSize:12 }}>{item.name}</td>
                                            <td style={{ padding:'6px 10px', fontSize:12, fontWeight:700, color:'#d97706' }}>{item.qty}</td>
                                            <td style={{ padding:'6px 10px', fontSize:11, color:'var(--t2)' }}>{item.note || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </>
                              )}
                              {!recipe.ingredients?.length && !recipe.spices?.length && (
                                <div style={{ fontSize:12, color:'var(--t2)', padding:'8px 0' }}>Yeh recipe ek base recipe ka combination hai — upar diye gaye recipe ko refer karein.</div>
                              )}
                            </div>
                          )}

                          {/* VIDHI TAB */}
                          {activeTab === 'vidhi' && (
                            <div style={{ padding:'14px 16px' }}>
                              {recipe.steps?.length > 0 ? (
                                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                                  {recipe.steps.map(step => (
                                    <div key={step.num} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                                      <div style={{ minWidth:28, height:28, borderRadius:'50%', background:'#e85d04', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{step.num}</div>
                                      <div>
                                        <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)', marginBottom:3 }}>{step.title}</div>
                                        <div style={{ fontSize:12, color:'var(--t2)', lineHeight:1.7 }}>{step.detail}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize:12, color:'var(--t2)' }}>Steps ke liye Rajma Tadka recipe → pehle Rajma base recipe dekhein, phir fresh ghee tadka add karein.</div>
                              )}
                            </div>
                          )}

                          {/* SERVING & TIPS TAB */}
                          {activeTab === 'serving' && (
                            <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
                              {recipe.serving && (
                                <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'12px 14px' }}>
                                  <div style={{ fontSize:12, fontWeight:700, color:'#15803d', marginBottom:6 }}>🍽 Serving Style</div>
                                  <div style={{ fontSize:12, color:'#166534', lineHeight:1.7 }}>{recipe.serving}</div>
                                </div>
                              )}
                              {recipe.tips?.length > 0 && (
                                <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, padding:'12px 14px' }}>
                                  <div style={{ fontSize:12, fontWeight:700, color:'#b45309', marginBottom:8 }}>💡 Chef Tips</div>
                                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                    {recipe.tips.map((tip, i) => (
                                      <div key={i} style={{ fontSize:12, color:'#92400e', lineHeight:1.6, display:'flex', gap:8 }}>
                                        <span style={{ flexShrink:0 }}>→</span>
                                        <span>{tip}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Combo Guide */}
              {(recipeCat === 'Sab Recipes' || !recipeSearch) && (
                <div style={{ marginTop:24, background:'var(--card)', border:'1px solid var(--bd)', borderRadius:14, overflow:'hidden' }}>
                  <div style={{ padding:'14px 16px', background:'#fff7ed', borderBottom:'1px solid var(--bd)' }}>
                    <h3 style={{ fontSize:14, fontWeight:700, color:'#e85d04' }}>🍱 Combo Guide — Kaunse Item Se Kya Banta Hai</h3>
                    <p style={{ fontSize:11, color:'var(--t2)', marginTop:2 }}>Har menu item kaun kaun se base recipes se banta hai</p>
                  </div>
                  <div style={{ overflowX:'auto', maxHeight:'50vh', overflowY:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, minWidth:500 }}>
                      <thead>
                        <tr style={{ background:'var(--bg)', position:'sticky', top:0, zIndex:1 }}>
                          <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--t2)', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:'1px solid var(--bd)' }}>Menu Item</th>
                          <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--t2)', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:'1px solid var(--bd)' }}>Base Recipe(s)</th>
                          <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--t2)', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:'1px solid var(--bd)' }}>Special Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {COMBO_GUIDE.map((c, i) => (
                          <tr key={i} style={{ borderBottom:'1px solid var(--bd)', background: i%2===0?'var(--card)':'var(--bg)' }}>
                            <td style={{ padding:'7px 12px', fontWeight:600, color:'var(--t1)', fontSize:12 }}>{c.item}</td>
                            <td style={{ padding:'7px 12px', color:'#e85d04', fontSize:11 }}>{c.base.join(' + ')}</td>
                            <td style={{ padding:'7px 12px', color:'var(--t2)', fontSize:11 }}>{c.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Kitchen Standards */}
              {(recipeCat === 'Sab Recipes' || !recipeSearch) && (
                <div style={{ marginTop:16, marginBottom:24, background:'var(--card)', border:'1px solid var(--bd)', borderRadius:14, overflow:'hidden' }}>
                  <div style={{ padding:'14px 16px', background:'#f0fdf4', borderBottom:'1px solid var(--bd)' }}>
                    <h3 style={{ fontSize:14, fontWeight:700, color:'#15803d' }}>✅ FoodFi Kitchen Standards & Quality Checklist</h3>
                  </div>
                  <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }}>
                    {KITCHEN_STANDARDS.map(std => (
                      <div key={std.category} style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)', marginBottom:8 }}>{std.category}</div>
                        {std.points.map((p, i) => (
                          <div key={i} style={{ fontSize:11, color:'var(--t2)', marginBottom:5, lineHeight:1.5, display:'flex', gap:6 }}>
                            <span style={{ color:'#22c55e', flexShrink:0 }}>✓</span>
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        })()}

      </main>

      {/* Order Detail Modal */}
      {showOrderDetail && orderDetail && (
        <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowOrderDetail(false)}>
          <div className={styles.modal} style={{ maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0 }}>Order #{orderDetail.order_number}</h3>
              <button onClick={() => setShowOrderDetail(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            {/* Customer card with call + map */}
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--t2)' }}>👤 CUSTOMER</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{orderDetail.customer_name}</div>
                  <div style={{ fontSize:12, color:'var(--t2)' }}>{orderDetail.customer_phone}</div>
                  <div style={{ fontSize:12, color:'var(--t3)', marginTop:4 }}>📍 {orderDetail.delivery_address}</div>
                  {orderDetail.distance_km && <div style={{ fontSize:11, color:'var(--t3)' }}>{parseFloat(orderDetail.distance_km).toFixed(1)} km</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <a href={`tel:${orderDetail.customer_phone}`}
                    style={{ display:'flex', alignItems:'center', gap:4, background:'#dcfce7', color:'#16a34a', borderRadius:8, padding:'6px 12px', textDecoration:'none', fontSize:12, fontWeight:600 }}>
                    📞 Call
                  </a>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orderDetail.delivery_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:4, background:'#dbeafe', color:'#1d4ed8', borderRadius:8, padding:'6px 12px', textDecoration:'none', fontSize:12, fontWeight:600 }}>
                    🗺️ Map
                  </a>
                </div>
              </div>
            </div>

            {/* Items */}
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--t2)' }}>📦 ITEMS</div>
              {(orderDetail.items||[]).map((item,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                  <span>{item.name} <span style={{ color:'var(--t2)' }}>×{item.quantity}</span></span>
                  <span style={{ fontWeight:600 }}>₹{Math.round(item.price*item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Notes */}
            {orderDetail.notes && (
              <div style={{ background:'#fef3c7', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#92400e' }}>
                📝 <strong>Customer Remarks:</strong> {orderDetail.notes}
              </div>
            )}

            {/* Bill */}
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}><span>Subtotal</span><span>₹{Math.round(orderDetail.subtotal)}</span></div>
              {orderDetail.discount_amount>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4, color:'var(--gr-d)' }}><span>Discount</span><span>−₹{Math.round(orderDetail.discount_amount)}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}><span>Delivery Charge</span><span>₹{Math.round(orderDetail.delivery_charge)}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, marginTop:8, paddingTop:8, borderTop:'1px solid var(--bdr)' }}><span>💵 Total (COD)</span><span style={{ color:'var(--or)' }}>₹{Math.round(orderDetail.total)}</span></div>
            </div>
            {orderDetail.delivery_boy_name && (
              <div style={{ marginTop:10, fontSize:12, color:'var(--gr-d)', fontWeight:600 }}>🛵 {orderDetail.delivery_boy_name} · {orderDetail.delivery_boy_phone}</div>
            )}
            {/* Print Bill Button */}
            <button onClick={() => {
              const w = window.open('','_blank','width=380,height=600')
              const items = (orderDetail.items||[]).map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${Math.round(i.subtotal)}</td></tr>`).join('')
              w.document.write(`<html><head><title>Receipt #${orderDetail.order_number}</title>
                <style>body{font-family:monospace;max-width:340px;margin:20px auto;font-size:13px}
                h2{text-align:center;margin:0}p{text-align:center;color:#666;margin:4px 0}
                table{width:100%;border-collapse:collapse;margin:12px 0}
                td{padding:4px 2px}hr{border:1px dashed #ccc}
                .total{font-size:16px;font-weight:bold}
                @media print{button{display:none}}</style></head>
                <body>
                <h2>🍽️ FoodFi Cloud Kitchen</h2>
                <p>${new Date(orderDetail.created_at).toLocaleString('en-IN')}</p>
                <p>Order #${orderDetail.order_number}</p>
                <hr/>
                <p style="text-align:left"><b>Customer:</b> ${orderDetail.customer_name}<br/>${orderDetail.customer_phone}<br/>📍 ${orderDetail.delivery_address}</p>
                <hr/>
                <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Amt</th></tr></thead>
                <tbody>${items}</tbody></table>
                <hr/>
                <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>₹${Math.round(orderDetail.subtotal)}</span></div>
                ${orderDetail.discount_amount>0?`<div style="display:flex;justify-content:space-between;color:green"><span>Discount</span><span>-₹${Math.round(orderDetail.discount_amount)}</span></div>`:''}
                <div style="display:flex;justify-content:space-between"><span>Delivery</span><span>₹${Math.round(orderDetail.delivery_charge)}</span></div>
                <hr/>
                <div class="total" style="display:flex;justify-content:space-between"><span>TOTAL (COD)</span><span>₹${Math.round(orderDetail.total)}</span></div>
                <p style="margin-top:20px">Shukriya! 🙏 FoodFi Cloud Kitchen</p>
                <button onclick="window.print()" style="margin-top:12px;width:100%;padding:10px;background:#e85d04;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">🖨️ Print</button>
                </body></html>`)
              w.document.close()
            }} style={{ marginTop:14, width:'100%', padding:'10px', background:'#1e293b', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' }}>
              🖨️ Print Bill / Receipt
            </button>
          </div>
        </div>
      )}

      {/* Manual / Phone Order Modal */}
      {showManualOrder && (
        <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowManualOrder(false)}>
          <div className={styles.modal} style={{ maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0 }}>📞 Phone/WhatsApp Order</h3>
              <button onClick={() => setShowManualOrder(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>
            <form onSubmit={submitManualOrder}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="field"><label>Customer Name</label><input required value={manualOrder.customerName} onChange={e => setManualOrder({...manualOrder, customerName:e.target.value})} placeholder="Rahul Kumar" /></div>
                <div className="field">
                  <label>Phone Number</label>
                  <div style={{ display:'flex', gap:0 }}>
                    <span style={{ padding:'8px 10px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:13, color:'var(--t2)', whiteSpace:'nowrap' }}>+91</span>
                    <input required value={manualOrder.customerPhone} onChange={e => setManualOrder({...manualOrder, customerPhone:'+91'+e.target.value.replace(/^\+91/,'')})} placeholder="98765 43210" style={{ borderRadius:'0 8px 8px 0' }} />
                  </div>
                </div>
              </div>
              <div className="field"><label>Delivery Address</label><input required value={manualOrder.address} onChange={e => setManualOrder({...manualOrder, address:e.target.value})} placeholder="Pura address daalo" /></div>
              <div className="field">
                <label>Items Select Karo</label>
                <div style={{ background:'var(--bg)', borderRadius:10, padding:'10px 12px', maxHeight:220, overflowY:'auto' }}>
                  {menuItems.filter(m=>m.is_available).map(item => {
                    const qty = manualOrder.items[item.id]||0
                    return (
                      <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div><div style={{ fontSize:13, fontWeight:500 }}>{item.name}</div><div style={{ fontSize:11, color:'var(--gr-d)' }}>₹{item.price}</div></div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <button type="button" onClick={() => { const ni={...manualOrder.items}; const q=Math.max(0,qty-1); if(q===0) delete ni[item.id]; else ni[item.id]=q; setManualOrder({...manualOrder,items:ni}) }} style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--bdr)', background:'var(--card)', cursor:'pointer', fontWeight:700 }}>−</button>
                          <span style={{ minWidth:18, textAlign:'center', fontWeight:600 }}>{qty}</span>
                          <button type="button" onClick={() => setManualOrder({...manualOrder,items:{...manualOrder.items,[item.id]:qty+1}})} style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--bdr)', background:qty>0?'var(--or)':'var(--card)', color:qty>0?'#fff':'inherit', cursor:'pointer', fontWeight:700 }}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
                <div className="field"><label>Notes</label><input value={manualOrder.notes} onChange={e => setManualOrder({...manualOrder,notes:e.target.value})} placeholder="Less spicy..." /></div>
                <div className="field"><label>Delivery ₹</label><input type="number" value={manualOrder.deliveryCharge} onChange={e => setManualOrder({...manualOrder,deliveryCharge:e.target.value})} /></div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowManualOrder(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }}>✅ Order Create Karo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Boy Detail Modal */}
      {showBoyDetail && boyDetail && (
        <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowBoyDetail(false)}>
          <div className={styles.modal} style={{ maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0 }}>🛵 {boyDetail.name}</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary" style={{ fontSize:12 }} onClick={() => setEditBoyMode(!editBoyMode)}>
                  {editBoyMode ? 'Cancel' : '✏️ Edit'}
                </button>
                <button onClick={() => setShowBoyDetail(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
              </div>
            </div>

            {editBoyMode ? (
              <div>
                <div className="field"><label>Name</label><input value={boyEditForm.name} onChange={e => setBoyEditForm({...boyEditForm, name:e.target.value})} /></div>
                <div className="field"><label>Phone</label><input value={boyEditForm.phone} onChange={e => setBoyEditForm({...boyEditForm, phone:e.target.value})} /></div>
                <div className="field"><label>Per KM Earning (₹)</label><input type="number" value={boyEditForm.per_km_earning} onChange={e => setBoyEditForm({...boyEditForm, per_km_earning:e.target.value})} /></div>
                <button className="btn btn-primary btn-full" onClick={saveBoyEdit}>💾 Save Changes</button>
              </div>
            ) : (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px', fontSize:13, marginBottom:16 }}>
                  {[
                    ['📧 Email', boyDetail.email],
                    ['📱 Phone', boyDetail.phone],
                    ['🛵 Vehicle Type', boyDetail.vehicle_type],
                    ['🚗 Vehicle No.', boyDetail.vehicle_number],
                    ['🪪 License No.', boyDetail.license_number || '—'],
                    ['🆔 Aadhar', boyDetail.aadhar_number ? '••••' + boyDetail.aadhar_number.slice(-4) : '—'],
                    ['🎂 Date of Birth', boyDetail.date_of_birth ? new Date(boyDetail.date_of_birth).toLocaleDateString('en-IN') : '—'],
                    ['🆘 Emergency', boyDetail.emergency_contact || '—'],
                    ['💰 Total Earnings', `₹${Math.round(boyDetail.total_earnings||0)}`],
                    ['⭐ Rating', parseFloat(boyDetail.rating||5).toFixed(1)],
                    ['📅 Joined', new Date(boyDetail.created_at).toLocaleDateString('en-IN')],
                    ['Status', boyDetail.is_online ? '🟢 Online' : '⚫ Offline'],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize:11, color:'var(--t2)', marginBottom:2 }}>{label}</div>
                      <div style={{ fontWeight:500 }}>{val}</div>
                    </div>
                  ))}
                </div>
                {boyDetail.home_address && (
                  <div style={{ background:'var(--bg)', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
                    <div style={{ fontSize:11, color:'var(--t2)', marginBottom:4 }}>🏠 Home Address</div>
                    <div style={{ fontSize:13 }}>{boyDetail.home_address}</div>
                  </div>
                )}
                {/* Payment Summary */}
                <div style={{ background:'var(--bg)', borderRadius:12, padding:'14px', marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:10, color:'var(--t2)' }}>💰 PAYMENT SUMMARY</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, textAlign:'center' }}>
                    <div style={{ background:'#dcfce7', borderRadius:10, padding:'10px 6px' }}>
                      <div style={{ fontSize:10, color:'#166534' }}>Total Earned</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#16a34a' }}>₹{Math.round(parseFloat(boyDetail.total_earnings||0))}</div>
                    </div>
                    <div style={{ background:'#dbeafe', borderRadius:10, padding:'10px 6px' }}>
                      <div style={{ fontSize:10, color:'#1d4ed8' }}>Total Paid</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#2563eb' }}>₹{Math.round(parseFloat(boyDetail.total_paid||0))}</div>
                    </div>
                    <div style={{ background: parseFloat(boyDetail.payment_due||0)>0 ? '#fef2f2':'var(--bg)', borderRadius:10, padding:'10px 6px' }}>
                      <div style={{ fontSize:10, color:'#dc2626' }}>Due Now</div>
                      <div style={{ fontSize:16, fontWeight:700, color: parseFloat(boyDetail.payment_due||0)>0?'#dc2626':'var(--t3)' }}>₹{Math.round(parseFloat(boyDetail.payment_due||0))}</div>
                    </div>
                  </div>
                  {parseFloat(boyDetail.payment_due||0) > 0 && (
                    <button className="btn btn-primary" style={{ width:'100%', marginTop:10, background:'#16a34a', border:'none' }}
                      onClick={() => { setShowBoyDetail(false); openPayModal(boyDetail) }}>
                      💰 Record Payment to {boyDetail.name}
                    </button>
                  )}
                </div>

                {/* Payment History */}
                {payHistory.length > 0 && (
                  <div style={{ background:'var(--bg)', borderRadius:12, padding:'14px', marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--t2)' }}>📋 PAYMENT HISTORY</div>
                    {payHistory.map((p, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--card)' }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--gr-d)' }}>₹{Math.round(parseFloat(p.amount))}</div>
                          {p.notes && <div style={{ fontSize:11, color:'var(--t2)' }}>{p.notes}</div>}
                        </div>
                        <div style={{ fontSize:11, color:'var(--t3)' }}>{new Date(p.created_at).toLocaleDateString('en-IN')}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display:'flex', gap:8 }}>
                  <a href={`tel:${boyDetail.phone}`} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#dcfce7', color:'#16a34a', borderRadius:10, padding:'10px', textDecoration:'none', fontWeight:700, fontSize:14 }}>📞 Call</a>
                  <button className="btn btn-secondary" style={{ flex:1, background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5' }} onClick={() => { setShowBoyDetail(false); suspendBoy(boyDetail.id) }}>🚫 Suspend</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Record Modal */}
      {showPayModal && payBoy && (
        <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowPayModal(false)}>
          <div className={styles.modal} style={{ maxWidth:400 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0 }}>💰 Record Payment</h3>
              <button onClick={() => setShowPayModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ background:'#fef3c7', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13 }}>
              <strong>{payBoy.name}</strong> ko dena hai: <strong style={{ color:'#dc2626' }}>₹{Math.round(parseFloat(payBoy.payment_due||0))}</strong>
            </div>

            <form onSubmit={recordPayment}>
              <div className="field">
                <label>Amount Paid (₹)</label>
                <input required type="number" min="1" step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder={`Max ₹${Math.round(parseFloat(payBoy.payment_due||0))}`}
                />
              </div>
              <div className="field">
                <label>Notes (optional)</label>
                <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Cash, UPI, Bank transfer..." />
              </div>
              <div style={{ background:'var(--bg)', borderRadius:10, padding:'10px 12px', marginBottom:14, fontSize:12, color:'var(--t2)' }}>
                <div>Total Earned: <strong>₹{Math.round(parseFloat(payBoy.total_earnings||0))}</strong></div>
                <div>Previously Paid: <strong>₹{Math.round(parseFloat(payBoy.total_paid||0))}</strong></div>
                <div>Currently Due: <strong style={{ color:'#dc2626' }}>₹{Math.round(parseFloat(payBoy.payment_due||0))}</strong></div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex:2, background:'#16a34a', border:'none' }}>✅ Mark as Paid</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Detail Modal */}
      {showPayoutModal && payoutBoy && (
        <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowPayoutModal(false)}>
          <div className={styles.modal} style={{ maxWidth:640, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0 }}>💰 Payout — {payoutBoy.name}</h3>
              <button onClick={() => setShowPayoutModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            {payoutLoading && <div style={{ textAlign:'center', padding:'40px', color:'var(--t2)' }}>Loading...</div>}

            {!payoutLoading && payoutData && (
              <>
                {/* Summary cards */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {[
                    { label:'Customer Paid', val:`₹${Math.round(parseFloat(payoutData.summary?.total_collected||0))}`, color:'#2563eb', bg:'#dbeafe' },
                    { label:'Boy Payout', val:`₹${Math.round(parseFloat(payoutData.summary?.total_to_pay||0))}`, color:'#16a34a', bg:'#dcfce7' },
                    { label:'Already Paid', val:`₹${Math.round(parseFloat(payoutData.summary?.total_paid||0))}`, color:'#7c3aed', bg:'#f5f3ff' },
                    { label:'Balance Due', val:`₹${Math.round(parseFloat(payoutData.summary?.balance_due||0))}`, color:'#dc2626', bg:'#fef2f2' },
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} style={{ background:bg, borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3, fontWeight:600 }}>{label}</div>
                      <div style={{ fontSize:15, fontWeight:800, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Record payment button */}
                {parseFloat(payoutData.summary?.balance_due||0) > 0 && (
                  <button className="btn btn-primary" style={{ width:'100%', background:'#16a34a', border:'none', marginBottom:16 }}
                    onClick={() => { setShowPayoutModal(false); openPayModal({ ...payoutBoy, payment_due: payoutData.summary.balance_due }) }}>
                    💳 Record Payment of ₹{Math.round(parseFloat(payoutData.summary.balance_due))}
                  </button>
                )}

                {/* Order-wise table */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', marginBottom:8, letterSpacing:0.5 }}>ORDER-WISE BREAKDOWN</div>
                  {payoutData.orders?.length === 0 && (
                    <div style={{ textAlign:'center', padding:'20px', color:'var(--t2)', fontSize:13 }}>Koi delivered order nahi</div>
                  )}
                  {payoutData.orders?.length > 0 && (
                    <div style={{ background:'var(--bg)', borderRadius:12, overflow:'hidden', border:'1px solid var(--bd)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'60px 90px 70px 90px 90px', gap:8, padding:'8px 12px', background:'var(--card)', fontSize:10, fontWeight:700, color:'var(--t2)' }}>
                        <span>ORDER</span><span>DATE</span><span>DIST</span><span>CUST PAID</span><span>BOY PAYOUT</span>
                      </div>
                      {payoutData.orders.map((o, i) => (
                        <div key={o.id} style={{ display:'grid', gridTemplateColumns:'60px 90px 70px 90px 90px', gap:8, padding:'8px 12px', borderTop:'1px solid var(--bd)', fontSize:12, alignItems:'center' }}>
                          <span style={{ fontWeight:700, color:'#2563eb' }}>#{o.order_number}</span>
                          <span style={{ color:'var(--t2)' }}>{new Date(o.delivered_at||o.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}</span>
                          <span>{o.distance_km ? `${parseFloat(o.distance_km).toFixed(1)} km` : '~3 km*'}</span>
                          <span style={{ color:'#2563eb', fontWeight:600 }}>₹{Math.round(parseFloat(o.delivery_charge||0))}</span>
                          <span style={{ color:'#16a34a', fontWeight:700 }}>₹{Math.round(parseFloat(o.boy_payout_calc||0))}</span>
                        </div>
                      ))}
                      {payoutData.orders.some(o => !o.distance_km) && (
                        <div style={{ padding:'6px 12px', fontSize:10, color:'var(--t3)', borderTop:'1px solid var(--bd)' }}>* Distance unavailable — 3km default assumed</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Payment ledger */}
                {payoutData.paymentHistory?.length > 0 && (
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', marginBottom:8, letterSpacing:0.5 }}>PAYMENT LEDGER</div>
                    <div style={{ background:'var(--bg)', borderRadius:12, overflow:'hidden', border:'1px solid var(--bd)' }}>
                      {payoutData.paymentHistory.map((p, i) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderTop: i>0?'1px solid var(--bd)':'none' }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'#16a34a' }}>✅ ₹{Math.round(parseFloat(p.amount))} paid</div>
                            {p.notes && <div style={{ fontSize:11, color:'var(--t2)' }}>{p.notes}</div>}
                          </div>
                          <div style={{ fontSize:11, color:'var(--t3)' }}>{new Date(p.created_at).toLocaleDateString('en-IN')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
