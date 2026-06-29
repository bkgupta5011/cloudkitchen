'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './admin.module.css'
import { usePushNotifications } from '@/lib/usePush'
import { RECIPES, RECIPE_CATEGORIES, COMBO_GUIDE, KITCHEN_STANDARDS, printRecipeBook } from '@/lib/recipes'

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return }
    const existing = document.getElementById('gmaps-script')
    if (existing) {
      const wait = setInterval(() => { if (window.google?.maps) { clearInterval(wait); resolve(window.google.maps) } }, 100)
      return
    }
    const script = document.createElement('script')
    script.id = 'gmaps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`
    script.async = true; script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function reverseGeocodeAdmin(lat, lng) {
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}&language=en&region=IN`)
    const data = await res.json()
    if (data.results?.[0]) return data.results[0].formatted_address
  } catch {}
  return ''
}

const SECTIONS = [
  { id: 'orders',    label: '📋 Orders',           badge: 'orders' },
  { id: 'menu',      label: '🍛 Menu Items' },
  { id: 'fitness',   label: '🥗 Fitness Corner' },
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
  { id: 'recipes',    label: '📖 Recipe Book' },
  { id: 'engagement', label: '💌 Engagement' },
  { id: 'branches',  label: '🏪 Branches' },
]

export default function AdminPage() {
  const router = useRouter()
  usePushNotifications(true) // Admin always subscribes to push
  const [section, setSection] = useState('orders')
  const [stockItems, setStockItems] = useState([])
  const [stockLoading, setStockLoading] = useState(false)
  const [kitchenOpen, setKitchenOpen] = useState(true)
  const [kitchenSettings, setKitchenSettings] = useState({ kitchen_name:'', address:'', phone:'', lat:'', lng:'', max_delivery_km:5, open_time:'09:00', close_time:'22:00', estimated_time:45, auto_schedule:false, order_timeout_minutes:2, escalation_interval_sec:30, review_reward_enabled:false, review_reward_amount:20, review_reward_min_order:99, boy_min_payout:25, boy_base_km:2, boy_per_km:7, min_order_value:99, small_order_fee:20, free_delivery_all:false, loyalty_enabled:false, loyalty_threshold:5, loyalty_reward:50, loyalty_min_order:199 })
  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [offers, setOffers] = useState([])
  const [boys, setBoys] = useState([])
  const [pendingBoys, setPendingBoys] = useState([])
  const [pricing, setPricing] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [branchAnalytics, setBranchAnalytics] = useState(null)
  const [branchAnalyticsLoading, setBranchAnalyticsLoading] = useState(false)
  const [baDateFrom, setBaDateFrom] = useState('')
  const [baDateTo, setBaDateTo] = useState('')
  const [apiUsage, setApiUsage] = useState(null)
  const [customers, setCustomers] = useState([])
  const [waMessage, setWaMessage] = useState('') // WhatsApp message — write once, send per customer
  const [loading, setLoading] = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddOffer, setShowAddOffer] = useState(false)
  const [showOrderDetail, setShowOrderDetail] = useState(false)
  const [orderDetail, setOrderDetail] = useState(null)
  const [showManualOrder, setShowManualOrder] = useState(false)
  const [showPhoneMap, setShowPhoneMap] = useState(false)
  const [manualOrder, setManualOrder] = useState({ customerName:'', customerPhone:'', address:'', notes:'', deliveryCharge:30, items:{}, lat:'', lng:'' })
  const phoneMapRef = useRef(null)
  const phoneMarkerRef = useRef(null)
  const phoneMapInstRef = useRef(null)
  const phoneSearchRef = useRef(null)
  const [newItem, setNewItem] = useState({ name:'', description:'', price:'', discount_percent:0, category:'Rice Combos', is_veg:true, image_url:'' })
  const [catEdits, setCatEdits] = useState({})   // per-item edited category (menu cards)
  const [newCats, setNewCats] = useState([])     // categories the admin just added

  // 🥗 Fitness Corner
  const EMPTY_FIT = { name:'', about:'', price:'', discount_percent:0, calories:'', protein_g:'', carbs_g:'', fat_g:'', fiber_g:'', other_nutrients:'', diet_tag:'', is_veg:true, image_url:'', is_available:false }
  const [fitnessItems, setFitnessItems] = useState([])
  const [fitCornerOn, setFitCornerOn] = useState(false)
  const [fitLoading, setFitLoading] = useState(false)
  const [showFitForm, setShowFitForm] = useState(false)
  const [editFitId, setEditFitId] = useState(null)
  const [fitForm, setFitForm] = useState(EMPTY_FIT)
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
  const [branchFilter, setBranchFilter] = useState('all')

  // Date range for order history — default: today (IST)
  const todayIST = () => {
    const now = new Date()
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    return ist.toISOString().slice(0, 10)
  }
  const [dateFrom, setDateFrom] = useState(todayIST())
  const [dateTo,   setDateTo]   = useState(todayIST())
  // Always-fresh copies of the selected range so the 10s poll/push refresh
  // stay strict to the chosen dates instead of overwriting with all orders.
  const dateFromRef = useRef(todayIST())
  const dateToRef   = useRef(todayIST())
  useEffect(() => { dateFromRef.current = dateFrom; dateToRef.current = dateTo }, [dateFrom, dateTo])
  const [notifCount, setNotifCount] = useState(0)
  const [toast, setToast] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({ title: '', body: '', target: 'customer', url: '' })
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)
  // Engagement
  const [engagementData, setEngagementData] = useState(null)
  const [engagementLoading, setEngagementLoading] = useState(false)
  const [engagementCat, setEngagementCat] = useState('')
  const [engagementNewMsg, setEngagementNewMsg] = useState('')
  const [engagementSaving, setEngagementSaving] = useState(false)
  const [testingNotif, setTestingNotif] = useState('')
  // ── Branches ──────────────────────────────────────────────────────
  const [branches, setBranches] = useState([])
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [editBranch, setEditBranch] = useState(null)
  const [branchSaving, setBranchSaving] = useState(false)
  const emptyBranch = { name:'', address:'', city:'', phone:'', lat:'', lng:'', opening_time:'09:00', closing_time:'22:00', max_delivery_km:'', type:'own', commission_percent:'' }
  const [newBranch, setNewBranch] = useState(emptyBranch)
  const [branchLocLoading, setBranchLocLoading] = useState(false)
  const [showBranchMap, setShowBranchMap] = useState(false)
  const branchMapRef    = useRef(null)
  const branchMarkerRef = useRef(null)
  const branchSearchRef = useRef(null)
  const branchMapInstRef = useRef(null)
  // Branch Login
  const [showBranchLogin, setShowBranchLogin] = useState(false)
  const [branchLoginTarget, setBranchLoginTarget] = useState(null)
  const [branchLoginPhone, setBranchLoginPhone] = useState('')
  const [branchLoginPass, setBranchLoginPass] = useState('')
  const [branchLoginSaving, setBranchLoginSaving] = useState(false)
  // Branch Inventory
  const [showInventory, setShowInventory] = useState(false)
  const [inventoryBranch, setInventoryBranch] = useState(null)
  const [inventoryItems, setInventoryItems] = useState([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [inventorySearch, setInventorySearch] = useState('')
  // Phase 4 — branch adds its OWN item
  const [showBranchAddItem, setShowBranchAddItem] = useState(false)
  const [branchNewItem, setBranchNewItem] = useState({ name:'', category:'', price:'', stock_count:'', is_veg:true, description:'' })
  const [branchItemSaving, setBranchItemSaving] = useState(false)

  // Recipe Book
  const [recipeCat, setRecipeCat] = useState('Sab Recipes')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [expandedRecipe, setExpandedRecipe] = useState(null)
  const [recipeTab, setRecipeTab] = useState({}) // { recipeId: 'ingredients'|'vidhi'|'serving' }
  const [newOrderPopup, setNewOrderPopup] = useState([]) // new orders for popup
  const lastOrderCount = useRef(0)
  const lastOrderIdsRef = useRef(new Set())             // tracks active order IDs across polls
  const lastAppCount = useRef(0)
  const alertCtxRef = useRef(null)
  const supportCtxRef = useRef(null)
  const escalationCtxRef = useRef(null)
  const sharedCtxRef = useRef(null)              // persistent, user-unlocked AudioContext
  const [audioReady, setAudioReady] = useState(false)
  const lastSupportUnread = useRef({})   // userId → unreadCount
  const activeChatUserRef = useRef(null) // activeChatUser ka current value (for closure use)
  const escalatedOrderIds = useRef(new Set())   // escalation already triggered for these
  const escalationTimerRef = useRef(null)        // repeating escalation interval
  const kitchenSettingsRef = useRef({ order_timeout_minutes: 2, escalation_interval_sec: 30 }) // closure-safe copy

  // Prime/resume audio — must be called once from a user gesture so the
  // browser's autoplay policy lets the order alarm actually make sound.
  const unlockAudio = () => {
    try {
      if (!sharedCtxRef.current || sharedCtxRef.current.state === 'closed') {
        sharedCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      if (sharedCtxRef.current.state === 'suspended') sharedCtxRef.current.resume().catch(() => {})
      setAudioReady(true)
    } catch {}
  }

  // Auto-unlock on the first interaction anywhere (admin always clicks around).
  useEffect(() => {
    const h = () => unlockAudio()
    window.addEventListener('pointerdown', h, { once: true })
    window.addEventListener('keydown', h, { once: true })
    return () => {
      window.removeEventListener('pointerdown', h)
      window.removeEventListener('keydown', h)
    }
  }, [])

  // Keep the kitchen device's screen awake so order polling never sleeps.
  // Re-acquires the lock whenever the tab becomes visible again.
  useEffect(() => {
    let wakeLock = null
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {}
    }
    request()
    const onVis = () => { if (document.visibilityState === 'visible') request() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      try { wakeLock && wakeLock.release() } catch {}
    }
  }, [])

  const playLoudAlert = () => {
    try {
      // Pehle wala alert band karo agar chal raha ho
      if (alertCtxRef.current) { try { alertCtxRef.current.close() } catch {} }
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      alertCtxRef.current = ctx

      // 15 second ka alarm — har 0.55s pe ek ding-dong pair
      const totalSecs = 15
      const step = 0.55
      const numBeeps = Math.ceil(totalSecs / step) // ~27 pairs

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

      // 15 second baad auto-close
      setTimeout(() => { try { ctx.close() } catch {}; alertCtxRef.current = null }, 16000)
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

  // Reload a branch's inventory list (after add/delete of a branch-owned item).
  const reloadInventory = async (branchId) => {
    try {
      const d = await fetch(`/api/admin?type=branch_inventory&branch_id=${branchId}`).then(r => r.json())
      setInventoryItems(d.items || [])
    } catch {}
  }

  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'me' }) })
      .then(r => r.json()).then(({ user }) => {
        if (!user || user.role !== 'admin') { router.push('/login'); return }
        setCurrentUser(user)
        // Branch admin → force to orders section
        if (user.branch_id) setSection('orders')
      })
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission()
    loadAll()

    // Auto-poll every 10s
    const interval = setInterval(async () => {
      try {
        const [ordRes, appRes] = await Promise.all([
          fetch(`/api/orders?date_from=${dateFromRef.current}&date_to=${dateToRef.current}`).then(r => r.json()),
          fetch('/api/admin?type=pending_boys').then(r => r.json()),
        ])
        const latest = ordRes.orders || []
        const activeOrders = latest.filter(o => !['delivered','cancelled'].includes(o.status))
        const activeCount  = activeOrders.length

        // Detect genuinely new orders (by ID, not just count)
        const newOnes = lastOrderIdsRef.current.size > 0
          ? activeOrders.filter(o => !lastOrderIdsRef.current.has(o.id))
          : []

        if (newOnes.length > 0) {
          playLoudAlert()
          setNotifCount(n => n + newOnes.length)
          // Fetch items for the first new order to show in popup
          const detail = await fetch(`/api/orders?id=${newOnes[0].id}`).then(r => r.json()).catch(() => ({}))
          const firstWithItems = { ...newOnes[0], items: detail.order?.items || [] }
          setNewOrderPopup([firstWithItems, ...newOnes.slice(1)])
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('🍽️ Naya Order!', { body: `${newOnes.length} naya order aa gaya!`, icon: '/favicon.ico' })
          }
        }

        // Update ID set for next poll
        lastOrderIdsRef.current = new Set(activeOrders.map(o => o.id))
        lastOrderCount.current  = activeCount
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

  // ── Service-worker push → ring loud + refresh INSTANTLY, even if the 10s
  //    polling was throttled/paused while the tab was in the background.
  //    This is the reliable path for catching orders when no one is looking. ──
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
    const handler = async (e) => {
      const type = e.data?.type
      if (type !== 'NEW_ORDER_ALARM' && type !== 'PLAY_NOTIFICATION_SOUND') return
      playLoudAlert()
      try {
        const ordRes = await fetch(`/api/orders?date_from=${dateFromRef.current}&date_to=${dateToRef.current}`).then(r => r.json())
        const latest = ordRes.orders || []
        const activeOrders = latest.filter(o => !['delivered', 'cancelled'].includes(o.status))
        const newOnes = lastOrderIdsRef.current.size > 0
          ? activeOrders.filter(o => !lastOrderIdsRef.current.has(o.id))
          : []
        if (newOnes.length > 0) {
          setNotifCount(n => n + newOnes.length)
          const detail = await fetch(`/api/orders?id=${newOnes[0].id}`).then(r => r.json()).catch(() => ({}))
          const firstWithItems = { ...newOnes[0], items: detail.order?.items || [] }
          setNewOrderPopup([firstWithItems, ...newOnes.slice(1)])
        }
        lastOrderIdsRef.current = new Set(activeOrders.map(o => o.id))
        setOrders(latest)
      } catch {}
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const t = todayIST()
    const [settingsRes, ordersRes, menuRes, offersRes, boysRes, pendingRes, pricingRes, analyticsRes, customersRes, noticesRes, branchesRes] = await Promise.all([
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
      fetch('/api/admin?type=branches').then(r => r.json()),
    ])
    const s = settingsRes.settings || {}
    setKitchenOpen(s.is_open ?? true)
    const ks = { kitchen_name: s.kitchen_name||'', address: s.address||'', phone: s.phone||'', lat: s.lat||'', lng: s.lng||'', max_delivery_km: s.max_delivery_km||5, open_time: s.open_time||'09:00', close_time: s.close_time||'22:00', estimated_time: s.estimated_time||45, auto_schedule: s.auto_schedule||false, order_timeout_minutes: s.order_timeout_minutes||2, escalation_interval_sec: s.escalation_interval_sec||30, review_reward_enabled: s.review_reward_enabled||false, review_reward_amount: s.review_reward_amount||20, review_reward_min_order: s.review_reward_min_order||99, boy_min_payout: s.boy_min_payout||25, boy_base_km: s.boy_base_km||2, boy_per_km: s.boy_per_km||7, min_order_value: s.min_order_value||99, small_order_fee: s.small_order_fee||20, free_delivery_all: s.free_delivery_all||false, loyalty_enabled: s.loyalty_enabled||false, loyalty_threshold: s.loyalty_threshold||5, loyalty_reward: s.loyalty_reward||50, loyalty_min_order: s.loyalty_min_order||199 }
    setKitchenSettings(ks)
    kitchenSettingsRef.current = ks
    const loadedOrders = ordersRes.orders || []
    setOrders(loadedOrders)
    const activeLoaded = loadedOrders.filter(o => !['delivered','cancelled'].includes(o.status))
    lastOrderCount.current  = activeLoaded.length
    lastOrderIdsRef.current = new Set(activeLoaded.map(o => o.id)) // snapshot — don't alert on existing orders
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
    setBranches(branchesRes?.branches || [])
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
      const list = res.orders || []
      setOrders(list)
      // Re-baseline new-order detection to the viewed range so switching dates
      // doesn't falsely flag old orders as "new" on the next poll.
      lastOrderIdsRef.current = new Set(list.filter(o => !['delivered', 'cancelled'].includes(o.status)).map(o => o.id))
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
    const res = await fetch('/api/orders/manual', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...manualOrder, deliveryLat: manualOrder.lat, deliveryLng: manualOrder.lng }) })
    const data = await res.json()
    if (!res.ok) { showToast('❌ ' + data.error); return }
    setShowManualOrder(false)
    setManualOrder({ customerName:'', customerPhone:'', address:'', notes:'', deliveryCharge:30, items:{}, lat:'', lng:'' })
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

  // All categories for the menu dropdowns (existing + admin-added), de-duplicated.
  const allCategories = () => [...new Set([
    ...menuItems.map(m => m.category),
    ...newCats,
    ...Object.values(catEdits),
    'Rice Combos', 'Fried Rice Combos', 'Roti & Puri Combos', 'Add-Ons',
  ].map(c => (c || '').trim()).filter(Boolean))]

  // Prompt for a brand-new category, remember it so it shows in every dropdown.
  const promptNewCategory = () => {
    const c = (window.prompt('Enter the new category name:') || '').trim()
    if (!c) return null
    setNewCats(prev => [...new Set([...prev, c])])
    return c
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

  // ── 🥗 Fitness Corner functions ──────────────────────────────────
  const loadFitness = () => {
    setFitLoading(true)
    fetch('/api/fitness').then(r => r.json())
      .then(d => { setFitnessItems(d.items || []); setFitCornerOn(!!d.cornerEnabled); setFitLoading(false) })
      .catch(() => setFitLoading(false))
  }

  const toggleFitCorner = async () => {
    const next = !fitCornerOn
    setFitCornerOn(next)
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'kitchen', fitness_corner_enabled: next }) })
    showToast(next ? '🟢 Fitness Corner LIVE! (ab order ho sakta hai)' : '🔴 Coming Soon mode (order band)')
  }

  const openAddFit  = () => { setEditFitId(null); setFitForm(EMPTY_FIT); setShowFitForm(true) }
  const openEditFit = (it) => {
    setEditFitId(it.id)
    setFitForm({ name:it.name, about:it.about||'', price:it.price, discount_percent:it.discount_percent||0,
      calories:it.calories, protein_g:it.protein_g, carbs_g:it.carbs_g, fat_g:it.fat_g, fiber_g:it.fiber_g,
      other_nutrients:it.other_nutrients||'', diet_tag:it.diet_tag||'', is_veg:it.is_veg, image_url:it.image_url||'', is_available:it.is_available })
    setShowFitForm(true)
  }

  const saveFit = async (e) => {
    e.preventDefault()
    // Nutrition is COMPULSORY — block save if anything missing
    const req = [['price','Price'],['calories','Calories'],['protein_g','Protein'],['carbs_g','Carbs'],['fat_g','Fat'],['fiber_g','Fiber']]
    for (const [f, label] of req) {
      if (fitForm[f] === '' || fitForm[f] == null || isNaN(parseFloat(fitForm[f]))) {
        showToast(`❌ "${label}" zaroori hai — fitness item bina nutrition save nahi hoga`); return
      }
    }
    if (!fitForm.name.trim()) { showToast('❌ Name zaroori hai'); return }
    const method = editFitId ? 'PATCH' : 'POST'
    const body = editFitId ? { ...fitForm, id: editFitId } : fitForm
    const res = await fetch('/api/fitness', { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { showToast('❌ ' + (d.error || 'Save fail')); return }
    setShowFitForm(false); showToast(editFitId ? '✅ Update ho gaya' : '✅ Item add ho gaya'); loadFitness()
  }

  const deleteFit = async (it) => {
    if (!window.confirm(`"${it.name}" delete karein?`)) return
    await fetch('/api/fitness?id=' + it.id, { method:'DELETE' })
    showToast('🗑️ Delete ho gaya'); loadFitness()
  }

  const toggleFitAvail = async (it) => {
    setFitnessItems(prev => prev.map(x => x.id === it.id ? { ...x, is_available: !x.is_available } : x))
    await fetch('/api/fitness', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: it.id, action:'toggle_available', is_available: !it.is_available }) })
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
      // Update local state with recalculated values from API
      const { payment_due, total_paid, total_earnings, over_paid } = data.boy
      setBoys(prev => prev.map(b => b.id === payBoy.id
        ? { ...b, payment_due, total_paid, total_earnings, live_earnings: total_earnings }
        : b))
      if (showBoyDetail && boyDetail?.id === payBoy.id) {
        setBoyDetail(prev => ({ ...prev, payment_due, total_paid, total_earnings }))
        const d = await fetch(`/api/admin?type=payment_history&boyId=${payBoy.id}`).then(r => r.json())
        setPayHistory(d.records || [])
      }
      if (over_paid > 0) showToast(`⚠️ ${payBoy.name} ko ₹${Math.round(over_paid)} over-paid hua hai`)
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

  const filteredOrders = orders
    .filter(o => statusFilter === 'all' || o.status === statusFilter)
    .filter(o => branchFilter === 'all' || o.branch_name === branchFilter)
  // Also add cancelled row styling

  const pendingCount = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length
  const unreadSupport = supportThreads.reduce((a, t) => a + parseInt(t.unread_count || 0), 0)

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><div className="spinner" /></div>

  return (
    <div className={styles.page}>

      {/* ── Enable-sound banner (browsers block audio until user taps once) ── */}
      {!audioReady && (
        <div
          onClick={() => { unlockAudio(); playLoudAlert() }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100000,
            background: '#dc2626', color: '#fff', textAlign: 'center',
            padding: '12px 16px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 2px 10px #0003',
          }}
        >
          🔔 Order alarm ON karne ke liye yahan TAP karo (ek baar)
        </div>
      )}

      {/* ── New Order Popup ─────────────────────────────────────────── */}
      {newOrderPopup.length > 0 && (() => {
        const o = newOrderPopup[0] // show first (latest) new order
        const extraCount = newOrderPopup.length - 1
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'popBgIn 0.25s ease',
          }}>
            <style>{`
              @keyframes popBgIn    { from { opacity:0 } to { opacity:1 } }
              @keyframes popCardIn  { from { opacity:0; transform:scale(0.82) translateY(-24px) } to { opacity:1; transform:scale(1) translateY(0) } }
              @keyframes bellRing   { 0%,100%{transform:rotate(0)} 15%{transform:rotate(-22deg)} 30%{transform:rotate(22deg)} 45%{transform:rotate(-16deg)} 60%{transform:rotate(16deg)} 75%{transform:rotate(-8deg)} }
              @keyframes ringPulse  { 0%,100%{box-shadow:0 0 0 0 #f59e0b88} 50%{box-shadow:0 0 0 18px #f59e0b00} }
              @keyframes tickerDot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.6)} }
            `}</style>

            <div style={{
              background: '#fff', borderRadius: 28, overflow: 'hidden',
              width: '100%', maxWidth: 480, boxShadow: '0 32px 80px #0007',
              animation: 'popCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              {/* ── Amber header ── */}
              <div style={{
                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                padding: '22px 24px 18px', textAlign: 'center', position: 'relative',
                animation: 'ringPulse 1.4s ease-in-out infinite',
              }}>
                <div style={{ fontSize: 52, animation: 'bellRing 0.7s ease-in-out infinite', display: 'inline-block', marginBottom: 6 }}>🔔</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: 1, textShadow: '0 2px 8px #0003' }}>
                  NAYA ORDER AAYA!
                </div>
                {extraCount > 0 && (
                  <div style={{ fontSize: 13, color: '#fef3c7', marginTop: 4, fontWeight: 700 }}>
                    + {extraCount} aur order{extraCount > 1 ? 's' : ''}
                  </div>
                )}
                {/* Pulsing dots row */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#fff',
                      animation: `tickerDot 1s ease-in-out infinite`,
                      animationDelay: `${i * 0.22}s`,
                    }} />
                  ))}
                </div>
              </div>

              {/* ── Order details ── */}
              <div style={{ padding: '18px 22px 22px' }}>
                {/* Order number + amount */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#64748b', letterSpacing: 0.5 }}>
                      ORDER #{o.order_number}
                    </div>
                    {o.branch_name && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', borderRadius: 6, padding: '2px 7px', marginTop: 4, display: 'inline-block' }}>
                        🏪 {o.branch_name}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#d97706' }}>
                    ₹{Math.round(o.total)}
                  </div>
                </div>

                {/* Customer */}
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 22 }}>👤</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{o.customer_name || '—'}</div>
                    {o.customer_phone && <div style={{ fontSize: 12, color: '#64748b' }}>{o.customer_phone}</div>}
                  </div>
                </div>

                {/* Address */}
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, marginTop: 1 }}>📍</span>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{o.delivery_address || '—'}</div>
                </div>

                {/* Items */}
                {o.items?.length > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', marginBottom: 7, letterSpacing: 0.4 }}>
                      📋 ITEMS ({o.items.reduce((s, i) => s + i.quantity, 0)} total)
                    </div>
                    {o.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#1a1a1a', paddingBottom: i < o.items.length - 1 ? 5 : 0 }}>
                        <span><span style={{ fontWeight: 700 }}>{item.quantity}×</span> {item.name}</span>
                        <span style={{ fontWeight: 600, color: '#15803d' }}>₹{Math.round(parseFloat(item.price) * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Delivery boy */}
                <div style={{ background: o.delivery_boy_name ? '#f0fdf4' : '#fffbeb', border: `1px solid ${o.delivery_boy_name ? '#86efac' : '#fcd34d'}`, borderRadius: 12, padding: '9px 14px', marginBottom: 16, fontSize: 13 }}>
                  {o.delivery_boy_name
                    ? <span>🛵 <strong>{o.delivery_boy_name}</strong> ko assign kiya gaya</span>
                    : <span>⚠️ <strong>Koi delivery boy assign nahi</strong> — manually karo</span>}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setNewOrderPopup([]); setSection('orders'); setNotifCount(0) }}
                    style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg,#d97706,#f59e0b)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 900, cursor: 'pointer', boxShadow: '0 6px 20px #f59e0b55' }}>
                    📋 Orders Dekho
                  </button>
                  <button
                    onClick={() => setNewOrderPopup([])}
                    style={{ flex: 1, padding: '14px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', color: '#64748b', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          {currentUser?.branch_id ? '🏪 Branch Panel' : '⚙️ Admin Panel'}
        </div>
        {currentUser?.branch_id && (
          <div style={{ fontSize:11, color:'#f97316', fontWeight:700, padding:'0 16px 10px', letterSpacing:0.3 }}>
            {branches.find(b => b.id === currentUser.branch_id)?.name || 'Branch Admin'}
          </div>
        )}
        {/* Vendor self-service: manage their OWN branch's menu (Phase 5) */}
        {currentUser?.branch_id && (
          <button className={styles.sideLink}
            onClick={async () => {
              const myBranch = branches.find(b => b.id === currentUser.branch_id) || { id: currentUser.branch_id, name: 'Mera Branch' }
              setInventoryBranch(myBranch); setInventorySearch(''); setShowBranchAddItem(false)
              setShowInventory(true); setInventoryLoading(true)
              try {
                const d = await fetch(`/api/admin?type=branch_inventory&branch_id=${currentUser.branch_id}`).then(r => r.json())
                setInventoryItems(d.items || [])
              } catch {}
              setInventoryLoading(false)
            }}>
            🍽️ Mera Menu
          </button>
        )}
        {(currentUser?.branch_id
          ? SECTIONS.filter(s => ['orders'].includes(s.id))
          : SECTIONS
        ).map(s => (
          <button key={s.id} className={`${styles.sideLink} ${section === s.id ? styles.active : ''}`}
            onClick={() => { setSection(s.id); if(s.id==='orders') setNotifCount(0); if(s.id==='support') loadSupportThreads(); if(s.id==='fitness') loadFitness(); if(s.id==='analytics') fetch('/api/track-usage').then(r=>r.json()).then(d=>setApiUsage(d)).catch(()=>{}); if(s.id==='stock'){ setStockLoading(true); fetch('/api/admin?type=stock').then(r=>r.json()).then(d=>{ setStockItems(d.items||[]); setStockLoading(false) }).catch(()=>setStockLoading(false)) } }}>
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

            {/* Branch-wise order summary — super admin only */}
            {!currentUser?.branch_id && branches.length > 0 && (() => {
              const branchStats = branches.map(b => ({
                name: b.name,
                total: orders.filter(o => o.branch_name === b.name).length,
                pending: orders.filter(o => o.branch_name === b.name && !['delivered','cancelled'].includes(o.status)).length,
                revenue: orders.filter(o => o.branch_name === b.name && o.status === 'delivered').reduce((s,o) => s + parseFloat(o.total||0), 0),
              }))
              return (
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
                  {branchStats.map(b => (
                    <div key={b.name}
                      onClick={() => setBranchFilter(branchFilter === b.name ? 'all' : b.name)}
                      style={{ flex:'1 1 160px', background: branchFilter === b.name ? '#ede9fe' : 'var(--card)', border:`1px solid ${branchFilter === b.name ? '#7c3aed' : 'var(--bd)'}`, borderRadius:12, padding:'10px 14px', cursor:'pointer' }}>
                      <div style={{ fontSize:12, fontWeight:700, color: branchFilter === b.name ? '#7c3aed' : 'var(--t1)', marginBottom:6 }}>🏪 {b.name}</div>
                      <div style={{ display:'flex', gap:12 }}>
                        <div><div style={{ fontSize:18, fontWeight:800, color:'var(--t1)' }}>{b.total}</div><div style={{ fontSize:10, color:'var(--t2)' }}>Orders</div></div>
                        {b.pending > 0 && <div><div style={{ fontSize:18, fontWeight:800, color:'#f59e0b' }}>{b.pending}</div><div style={{ fontSize:10, color:'var(--t2)' }}>Active</div></div>}
                        <div><div style={{ fontSize:14, fontWeight:700, color:'#16a34a' }}>₹{Math.round(b.revenue)}</div><div style={{ fontSize:10, color:'var(--t2)' }}>Revenue</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

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

                {/* Branch filter — super admin only */}
                {!currentUser?.branch_id && branches.length > 0 && (
                  <select
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                    style={{ border:'1px solid var(--bd2)', borderRadius:6, padding:'5px 10px', fontSize:12, color:'var(--t1)', background:'var(--card)', cursor:'pointer' }}>
                    <option value="all">🏪 All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                )}

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
            <p style={{ fontSize:12, color:'var(--t2)', margin:'0 0 12px' }}>Tip: edit an item&apos;s name or category right on its card, then hit <b>Save</b>. Use the category dropdown — or pick &ldquo;➕ Add new category&rdquo; to create one.</p>
            <div className={styles.menuGrid}>
              {(() => {
                const headerSty = { gridColumn:'1 / -1', fontSize:13, fontWeight:800, color:'var(--t1)', padding:'14px 4px 4px', borderBottom:'1.5px solid var(--bd)', marginTop:4 }
                const sortCat = (a, b) => (a.category||'').localeCompare(b.category||'') || ((a.sort_order||0) - (b.sort_order||0)) || (a.name||'').localeCompare(b.name||'')
                const renderCard = (item) => (
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

                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                    <span className={`veg-dot ${item.is_veg?'veg':'nonveg'}`} />
                    <input defaultValue={item.name} id={`name-${item.id}`}
                      style={{ fontSize:12, fontWeight:700, flex:1, minWidth:0, border:'1px solid var(--bd2)', borderRadius:6, padding:'4px 7px', background:'var(--bg)', color:'var(--t1)', boxSizing:'border-box' }} />
                    {item.stock_count !== null && item.stock_count !== undefined && parseInt(item.stock_count) <= 5 && (
                      <span style={{ background:'#fef2f2', color:'#dc2626', borderRadius:6, padding:'1px 6px', fontSize:10, fontWeight:700, flexShrink:0 }}>⚠️ {item.stock_count}</span>
                    )}
                  </div>
                  <select
                    value={catEdits[item.id] ?? item.category}
                    onChange={e => {
                      if (e.target.value === '__new__') { const c = promptNewCategory(); if (c) setCatEdits(prev => ({ ...prev, [item.id]: c })) }
                      else setCatEdits(prev => ({ ...prev, [item.id]: e.target.value }))
                    }}
                    style={{ fontSize:11, marginBottom:8, width:'100%', border:'1px solid var(--bd2)', borderRadius:6, padding:'5px 7px', background:'var(--bg)', color:'var(--t1)', boxSizing:'border-box', cursor:'pointer' }}>
                    {allCategories().map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__new__">➕ Add new category…</option>
                  </select>
                  <textarea defaultValue={item.description || ''} id={`desc-${item.id}`} rows={2} placeholder="Description (optional)"
                    style={{ fontSize:11, marginBottom:8, width:'100%', border:'1px solid var(--bd2)', borderRadius:6, padding:'5px 7px', background:'var(--bg)', color:'var(--t1)', boxSizing:'border-box', resize:'vertical', fontFamily:'inherit', lineHeight:1.4 }} />
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
                    const name = document.getElementById(`name-${item.id}`).value.trim()
                    const category = (catEdits[item.id] ?? item.category ?? '').trim()
                    if (!name || !category) { showToast('❌ Name and category are required'); return }
                    const price = parseFloat(document.getElementById(`price-${item.id}`).value)
                    const discount_percent = parseInt(document.getElementById(`disc-${item.id}`).value) || 0
                    const description = document.getElementById(`desc-${item.id}`).value
                    try {
                      const res = await fetch('/api/menu', { method:'PATCH', headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({ id:item.id, name, category, description, price, discount_percent, stock_count: stockRaw===''?null:parseInt(stockRaw) }) })
                      if (!res.ok) { showToast('❌ Could not save'); return }
                      setMenuItems(prev => prev.map(m => m.id===item.id ? { ...m, name, category, description, price, discount_percent, stock_count: stockRaw===''?null:parseInt(stockRaw) } : m))
                      showToast('✅ Item updated')
                    } catch { showToast('❌ Network error') }
                  }}>Save</button>
                  <div className={styles.availToggle}>
                    <div className={`switch ${item.is_available?'on':''}`} onClick={() => toggleMenuItem(item.id, !item.is_available)} />
                    <span style={{ fontSize:12, color:'var(--t2)' }}>{item.is_available?'Available':'Unavailable'}</span>
                  </div>
                </div>
                )
                // Available items first, grouped by category; unavailable at the end.
                const avail = menuItems.filter(m => m.is_available).sort(sortCat)
                const unavail = menuItems.filter(m => !m.is_available).sort(sortCat)
                const out = []
                let lastCat = null
                avail.forEach(it => {
                  const c = it.category || 'Uncategorized'
                  if (c !== lastCat) { lastCat = c; out.push(<div key={'h-' + c} style={headerSty}>📂 {c}</div>) }
                  out.push(renderCard(it))
                })
                if (unavail.length) {
                  out.push(<div key="h-unavail" style={{ ...headerSty, color:'#dc2626' }}>🚫 Unavailable ({unavail.length})</div>)
                  unavail.forEach(it => out.push(renderCard(it)))
                }
                return out
              })()}
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
                    <div className="field"><label>Category</label>
                      <select value={newItem.category}
                        onChange={e => {
                          if (e.target.value === '__new__') { const c = promptNewCategory(); if (c) setNewItem({ ...newItem, category: c }) }
                          else setNewItem({ ...newItem, category: e.target.value })
                        }}>
                        {[...new Set([...allCategories(), newItem.category].filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__new__">➕ Add new category…</option>
                      </select>
                    </div>
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

        {/* ── 🥗 FITNESS CORNER ── */}
        {section === 'fitness' && (
          <>
            {/* Master ON/OFF toggle */}
            <div style={{ background:'var(--card)', borderRadius:14, padding:'16px 18px', border:'1.5px solid '+(fitCornerOn?'#34d399':'#fbbf24'), marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:15, fontWeight:800 }}>🥗 Fitness Freak Corner — {fitCornerOn ? '🟢 LIVE' : '🟡 Coming Soon'}</div>
                <div style={{ fontSize:12, color:'var(--t2)', marginTop:3 }}>
                  {fitCornerOn
                    ? 'Corner LIVE hai — "Available" items customer order kar sakta hai.'
                    : 'Customer ko "Coming Soon" dikh raha hai (order band). ON karo to ordering allowed ho jayega.'}
                </div>
              </div>
              <div className={`switch ${fitCornerOn?'on':''}`} onClick={toggleFitCorner} />
            </div>

            <div className={styles.sectionHead}><h2>Fitness Items ({fitnessItems.length})</h2><button className="btn btn-primary" onClick={openAddFit}>+ Add Healthy Item</button></div>

            {fitLoading ? <div style={{ textAlign:'center', padding:40 }}><span className="spinner" /></div> : (
              <div className={styles.menuGrid}>
                {fitnessItems.map(it => (
                  <div key={it.id} className={styles.menuCard}>
                    <div style={{ position:'relative', width:'100%', height:100, borderRadius:8, marginBottom:8, background:'var(--bg)', overflow:'hidden' }}>
                      {it.image_url
                        ? <img src={it.image_url} alt={it.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize:32 }}>🥗</div>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4, flexWrap:'wrap' }}>
                      <span className={`veg-dot ${it.is_veg?'veg':'nonveg'}`} />
                      <strong style={{ fontSize:12 }}>{it.name}</strong>
                    </div>
                    <div style={{ fontSize:10.5, color:'var(--t2)', marginBottom:6, display:'flex', gap:6, flexWrap:'wrap' }}>
                      <span>🔥 {it.calories}cal</span><span>💪 {it.protein_g}g</span><span>🍚 {it.carbs_g}g</span><span>🧈 {it.fat_g}g</span><span>🌾 {it.fiber_g}g</span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#065f46', marginBottom:8 }}>₹{it.price}</div>
                    <div className={styles.availToggle}>
                      <div className={`switch ${it.is_available?'on':''}`} onClick={() => toggleFitAvail(it)} />
                      <span style={{ fontSize:12, color:'var(--t2)' }}>{it.is_available?'Available':'Unavailable'}</span>
                    </div>
                    <div style={{ display:'flex', gap:6, marginTop:8 }}>
                      <button className="btn btn-secondary" style={{ flex:1, fontSize:11, padding:'4px 8px' }} onClick={() => openEditFit(it)}>✏️ Edit</button>
                      <button className="btn btn-secondary" style={{ fontSize:11, padding:'4px 10px', color:'#dc2626' }} onClick={() => deleteFit(it)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showFitForm && (
              <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowFitForm(false)}>
                <div className={styles.modal} style={{ maxHeight:'90vh', overflowY:'auto' }}>
                  <h3>{editFitId ? 'Edit' : 'Add'} Healthy Item</h3>
                  <form onSubmit={saveFit}>
                    <div className="field"><label>Item Name *</label><input required value={fitForm.name} onChange={e=>setFitForm({...fitForm, name:e.target.value})} /></div>
                    <div className="field"><label>About (short description)</label><input value={fitForm.about} onChange={e=>setFitForm({...fitForm, about:e.target.value})} /></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div className="field"><label>Price (₹) *</label><input required type="number" value={fitForm.price} onChange={e=>setFitForm({...fitForm, price:e.target.value})} /></div>
                      <div className="field"><label>Discount %</label><input type="number" value={fitForm.discount_percent} onChange={e=>setFitForm({...fitForm, discount_percent:e.target.value})} /></div>
                    </div>
                    <div style={{ background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:10, padding:'10px 12px', margin:'4px 0 12px' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#065f46', marginBottom:8 }}>🔒 Nutrition — COMPULSORY (bina bhare save nahi hoga)</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <div className="field"><label>Calories (kcal) *</label><input required type="number" value={fitForm.calories} onChange={e=>setFitForm({...fitForm, calories:e.target.value})} /></div>
                        <div className="field"><label>Protein (g) *</label><input required type="number" value={fitForm.protein_g} onChange={e=>setFitForm({...fitForm, protein_g:e.target.value})} /></div>
                        <div className="field"><label>Carbs (g) *</label><input required type="number" value={fitForm.carbs_g} onChange={e=>setFitForm({...fitForm, carbs_g:e.target.value})} /></div>
                        <div className="field"><label>Fat (g) *</label><input required type="number" value={fitForm.fat_g} onChange={e=>setFitForm({...fitForm, fat_g:e.target.value})} /></div>
                        <div className="field"><label>Fiber (g) *</label><input required type="number" value={fitForm.fiber_g} onChange={e=>setFitForm({...fitForm, fiber_g:e.target.value})} /></div>
                      </div>
                    </div>
                    <div className="field"><label>Other Nutrients</label><input value={fitForm.other_nutrients} onChange={e=>setFitForm({...fitForm, other_nutrients:e.target.value})} placeholder="Iron, Calcium, B12" /></div>
                    <div className="field"><label>Diet Tag</label><input value={fitForm.diet_tag} onChange={e=>setFitForm({...fitForm, diet_tag:e.target.value})} placeholder="High Protein / Low Carb" /></div>
                    <div style={{ display:'flex', gap:18, alignItems:'center', margin:'4px 0 12px', flexWrap:'wrap' }}>
                      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                        <div className={`switch ${fitForm.is_veg?'on':''}`} onClick={()=>setFitForm({...fitForm, is_veg:!fitForm.is_veg})} /> {fitForm.is_veg?'🟢 Veg':'🔴 Non-veg'}
                      </label>
                      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                        <div className={`switch ${fitForm.is_available?'on':''}`} onClick={()=>setFitForm({...fitForm, is_available:!fitForm.is_available})} /> {fitForm.is_available?'Available':'Unavailable'}
                      </label>
                    </div>
                    <div className="field">
                      <label>Photo (Cloudinary)</label>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        {fitForm.image_url && <img src={fitForm.image_url} style={{ width:60, height:45, objectFit:'cover', borderRadius:6 }} />}
                        <label style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'var(--bg)', border:'1px dashed var(--bdr)', borderRadius:8, cursor:'pointer', fontSize:12 }}>
                          📷 {uploadingImg ? 'Uploading...' : 'Choose Photo (JPEG)'}
                          <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} disabled={uploadingImg}
                            onChange={e => { if(e.target.files[0]) uploadImage(e.target.files[0], url => setFitForm(f => ({...f, image_url:url}))) }} />
                        </label>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowFitForm(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={uploadingImg}>{editFitId?'Save Changes':'Add Item'}</button>
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
                    <span style={{ fontWeight:600, color:'var(--gr-d)', fontSize:13 }}>₹{Math.round(parseFloat(b.live_earnings ?? b.total_earnings ?? 0))}</span>
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

              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1.5px solid #16a34a', gridColumn:'1/-1' }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>🛵 Delivery Boy Payout</h3>
                <p style={{ fontSize:11, color:'var(--t3)', marginBottom:14 }}>
                  Boy ka payout customer ke delivery charge se ALAG hai (free delivery pe bhi boy ko pura milega — gap FoodFi bharega). Kitchen se distance pe calculate hota hai.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  <div className="field">
                    <label>Minimum Payout (₹)</label>
                    <input type="number" value={kitchenSettings.boy_min_payout} onChange={e => setKitchenSettings({...kitchenSettings, boy_min_payout:e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Base km (min mein included)</label>
                    <input type="number" value={kitchenSettings.boy_base_km} onChange={e => setKitchenSettings({...kitchenSettings, boy_base_km:e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Per km (base ke baad ₹)</label>
                    <input type="number" value={kitchenSettings.boy_per_km} onChange={e => setKitchenSettings({...kitchenSettings, boy_per_km:e.target.value})} />
                  </div>
                </div>
                {(() => {
                  const m = parseFloat(kitchenSettings.boy_min_payout)||0
                  const b = parseFloat(kitchenSettings.boy_base_km)||0
                  const k = parseFloat(kitchenSettings.boy_per_km)||0
                  const calc = (d) => Math.round(m + Math.max(0, d - b) * k)
                  return (
                    <div style={{ fontSize:12, color:'var(--gr-d)', marginTop:6, lineHeight:1.7 }}>
                      Example: 1.4 km → <b>₹{calc(1.4)}</b> · 3 km → <b>₹{calc(3)}</b> · 5 km → <b>₹{calc(5)}</b>
                    </div>
                  )
                })()}
              </div>

              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1.5px solid #e85d04', gridColumn:'1/-1' }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>🧾 Minimum Order & Small-Order Fee</h3>
                <p style={{ fontSize:11, color:'var(--t3)', marginBottom:14 }}>
                  Chhote order pe loss rokne ke liye: order is value se kam ho to ek chhota fee lagta hai. (Free-delivery threshold "KM Pricing" tab me set hota hai.)
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field">
                    <label>Minimum Order Value (₹)</label>
                    <input type="number" value={kitchenSettings.min_order_value} onChange={e => setKitchenSettings({...kitchenSettings, min_order_value:e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Small-Order Fee (₹)</label>
                    <input type="number" value={kitchenSettings.small_order_fee} onChange={e => setKitchenSettings({...kitchenSettings, small_order_fee:e.target.value})} />
                  </div>
                </div>
                <div style={{ fontSize:12, color:'#e85d04', marginTop:6, lineHeight:1.7 }}>
                  ₹{kitchenSettings.min_order_value} se kam ka order → <b>₹{kitchenSettings.small_order_fee}</b> extra fee. Upar → koi fee nahi.
                </div>

                {/* Free Delivery Festival — one-click marketing promo */}
                <div style={{ marginTop:16, paddingTop:14, borderTop:'1px dashed var(--bd2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color: kitchenSettings.free_delivery_all ? '#16a34a' : 'var(--t1)' }}>🎉 Free Delivery Festival</div>
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>ON karte hi <b>sabhi customers</b> ko delivery FREE (chahe order kitna bhi ho). Marketing push ke liye — boy ko fir bhi pura payout milega (FoodFi bharega).</div>
                  </div>
                  <div onClick={() => setKitchenSettings({...kitchenSettings, free_delivery_all: !kitchenSettings.free_delivery_all})}
                    style={{ width:52, height:30, borderRadius:15, background: kitchenSettings.free_delivery_all ? 'var(--gr)' : 'var(--bd2)', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                    <div style={{ position:'absolute', width:24, height:24, background:'#fff', borderRadius:'50%', top:3, left: kitchenSettings.free_delivery_all ? 25 : 3, transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }} />
                  </div>
                </div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:8 }}>⚠️ Save Changes dabana mat bhoolna.</div>
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

              {/* 🎁 Review Reward control (super admin) */}
              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1.5px solid #34d399', gridColumn:'1/-1' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>🎁 Review Reward</h3>
                  <div className={`switch ${kitchenSettings.review_reward_enabled?'on':''}`} onClick={() => setKitchenSettings({...kitchenSettings, review_reward_enabled:!kitchenSettings.review_reward_enabled})} />
                </div>
                <p style={{ fontSize:11, color:'var(--t2)', marginBottom:14 }}>Customer jab kisi delivered order ko review karega, use agle order pe discount milega (auto-apply, ₹{kitchenSettings.review_reward_min_order}+ ke order pe). Margin ka dhyan rakhte hue kabhi bhi band kar sakte ho.</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, opacity: kitchenSettings.review_reward_enabled ? 1 : 0.5, pointerEvents: kitchenSettings.review_reward_enabled ? 'auto' : 'none' }}>
                  <div className="field">
                    <label>Reward Amount (₹)</label>
                    <input type="number" min="1" max="500" value={kitchenSettings.review_reward_amount} onChange={e => setKitchenSettings({...kitchenSettings, review_reward_amount:e.target.value})} />
                    <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Har review pe customer ko itna ₹ off (agle order pe)</p>
                  </div>
                  <div className="field">
                    <label>Min Order (₹)</label>
                    <input type="number" min="0" max="2000" value={kitchenSettings.review_reward_min_order} onChange={e => setKitchenSettings({...kitchenSettings, review_reward_min_order:e.target.value})} />
                    <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Reward use karne ke liye order kam se kam itne ka ho</p>
                  </div>
                </div>
                <p style={{ fontSize:11, color:'#065f46', background:'#d1fae5', borderRadius:8, padding:'8px 12px', margin:0 }}>
                  💡 Option A: har review pe reward milta hai → repeat orders + reviews badhte hain. Default: ₹20, min ₹99.
                </p>
              </div>

              {/* 🔁 Loyalty / Repeat Reward (super admin) */}
              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1.5px solid #f59e0b', gridColumn:'1/-1' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>🔁 Loyalty / Repeat Reward</h3>
                  <div className={`switch ${kitchenSettings.loyalty_enabled?'on':''}`}
                    onClick={async () => {
                      const next = !kitchenSettings.loyalty_enabled
                      setKitchenSettings(p => ({ ...p, loyalty_enabled: next }))
                      try {
                        await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'kitchen', loyalty_enabled: next }) })
                        showToast(next ? '🔁 Loyalty reward turned ON' : '🔴 Loyalty reward turned OFF')
                      } catch { showToast('❌ Could not update — try again') }
                    }} />
                </div>
                <p style={{ fontSize:11, color:'var(--t2)', marginBottom:14 }}>
                  After every <b>{kitchenSettings.loyalty_threshold}</b> delivered orders, the customer gets <b>₹{kitchenSettings.loyalty_reward}</b> off (auto-applied on their next order) — like a stamp card that drives repeat orders. <b>This toggle saves instantly.</b>
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:10, opacity: kitchenSettings.loyalty_enabled ? 1 : 0.5, pointerEvents: kitchenSettings.loyalty_enabled ? 'auto' : 'none' }}>
                  <div className="field">
                    <label>Orders per reward</label>
                    <input type="number" min="2" max="20" value={kitchenSettings.loyalty_threshold} onChange={e => setKitchenSettings({...kitchenSettings, loyalty_threshold:e.target.value})} />
                    <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>One reward for every this many delivered orders</p>
                  </div>
                  <div className="field">
                    <label>Reward Amount (₹)</label>
                    <input type="number" min="1" max="500" value={kitchenSettings.loyalty_reward} onChange={e => setKitchenSettings({...kitchenSettings, loyalty_reward:e.target.value})} />
                    <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Discount on the next order when earned</p>
                  </div>
                  <div className="field">
                    <label>Min order to redeem (₹)</label>
                    <input type="number" min="0" max="2000" value={kitchenSettings.loyalty_min_order} onChange={e => setKitchenSettings({...kitchenSettings, loyalty_min_order:e.target.value})} />
                    <p style={{ fontSize:11, color: (parseInt(kitchenSettings.loyalty_min_order)||0) <= (parseInt(kitchenSettings.loyalty_reward)||0) ? '#dc2626' : 'var(--t3)', marginTop:4 }}>
                      Reward applies only on orders ≥ this. Keep it well above the reward (e.g. reward ₹{kitchenSettings.loyalty_reward} → min ₹{(parseInt(kitchenSettings.loyalty_reward)||0)+100}) so orders never hit ₹0.
                    </p>
                  </div>
                </div>
                <p style={{ fontSize:11, color:'#92400e', background:'#fef3c7', borderRadius:8, padding:'8px 12px', margin:0 }}>
                  💡 Customers see a stamp card on the cart &amp; orders pages ("{Math.max(0,(parseInt(kitchenSettings.loyalty_threshold)||5)-1)}/{kitchenSettings.loyalty_threshold} — 1 more order to unlock ₹{kitchenSettings.loyalty_reward} off"). Amount/threshold changes need the <b>Save Changes</b> button below.
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── KM PRICING ── */}
        {section === 'pricing' && (
          <>
            <div className={styles.sectionHead}><h2>Delivery Pricing</h2><button className="btn btn-primary" onClick={savePricing}>Save Changes</button></div>
            <p style={{ fontSize:12, color:'var(--t2)', margin:'0 0 12px' }}>
              <strong>Base Charge</strong> = delivery fee jab order chhota ho. <strong>FREE Above ₹</strong> = itne ka order karne pe delivery FREE (offer). Blank = is range me free delivery nahi.
            </p>
            <div className={styles.table}>
              <div className={`${styles.tHead}`} style={{ gridTemplateColumns:'1.2fr 0.8fr 1fr 1fr 1.1fr' }}><span>Range</span><span>Min KM</span><span>Base Charge (₹)</span><span>Per Extra KM (₹)</span><span>FREE Above ₹</span></div>
              {pricing.map((row, i) => (
                <div key={row.id} className={styles.tRow} style={{ gridTemplateColumns:'1.2fr 0.8fr 1fr 1fr 1.1fr' }}>
                  <span style={{ fontWeight:500, fontSize:12 }}>{row.min_km} – {row.max_km??'∞'} km</span>
                  <span style={{ fontSize:12, color:'var(--t2)' }}>{row.min_km} km</span>
                  <input type="number" defaultValue={row.base_charge} className={styles.priceInput} onChange={e => { const p=[...pricing]; p[i]={...p[i],base_charge:e.target.value}; setPricing(p) }} />
                  <input type="number" defaultValue={row.per_km_charge} className={styles.priceInput} onChange={e => { const p=[...pricing]; p[i]={...p[i],per_km_charge:e.target.value}; setPricing(p) }} />
                  <input type="number" defaultValue={row.free_delivery_min ?? ''} placeholder="—" className={styles.priceInput} onChange={e => { const p=[...pricing]; p[i]={...p[i],free_delivery_min:e.target.value}; setPricing(p) }} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CUSTOMERS ── */}
        {section === 'customers' && (() => {
          // Sort: latest joined first
          const sorted = [...customers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

          // Excel/CSV export
          const exportCSV = () => {
            const headers = ['Name', 'Email', 'Phone', 'Orders', 'Total Spent (₹)', 'Joined', 'Last Order']
            const rows = sorted.map(c => [
              c.name || '',
              c.email || '',
              c.phone || '',
              c.total_orders || 0,
              Math.round(c.total_spent || 0),
              c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '',
              c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('en-IN') : '',
            ])
            const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `FoodFi_Customers_${new Date().toISOString().slice(0,10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
          }

          return (
            <>
              <div className={styles.sectionHead}>
                <h2>Customers</h2>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:12, color:'var(--t2)' }}>{customers.length} registered</span>
                  <button onClick={exportCSV} style={{
                    display:'flex', alignItems:'center', gap:5,
                    background:'#16a34a', color:'#fff', border:'none', borderRadius:8,
                    padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer',
                  }}>
                    📥 Excel Export
                  </button>
                </div>
              </div>

              {/* WhatsApp helper — write a message once, send to each customer with one click */}
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#15803d', marginBottom:6 }}>💬 WhatsApp message — ek baar likho, har customer ke saamne 🟢 button se bhejo</div>
                <textarea
                  value={waMessage}
                  onChange={e => setWaMessage(e.target.value)}
                  placeholder="Namaste! 🙏 FoodFi pe aaj Chole Chawal sirf ₹99 se shuru. Order karo: https://foodfi.in"
                  rows={3}
                  style={{ width:'100%', boxSizing:'border-box', borderRadius:8, border:'1px solid #bbf7d0', padding:'8px 10px', fontSize:13, resize:'vertical', fontFamily:'inherit' }}
                />
                <div style={{ fontSize:11, color:'var(--t2)', marginTop:4 }}>
                  🟢 Send dabate hi naye tab mein WhatsApp khulega, message pehle se bhara hoga — bas Send dabao. (Pehle WhatsApp Web pe login hona chahiye.)
                </div>
              </div>

              <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'calc(100vh - 340px)', borderRadius:12, border:'1px solid var(--bdr)' }}>
                <div className={styles.table} style={{ minWidth:780 }}>
                  <div className={`${styles.tHead}`} style={{ gridTemplateColumns:'1.8fr 1.4fr 0.7fr 0.9fr 1fr 1.2fr 0.9fr', position:'sticky', top:0, zIndex:2 }}>
                    <span>Name</span><span>Phone</span><span>Orders</span><span>Total Spent</span><span>Joined</span><span>Last Order</span><span>WhatsApp</span>
                  </div>
                  {sorted.map(c => {
                    const waDigits = (c.phone || '').replace(/\D/g, '')
                    return (
                    <div key={c.id} className={`${styles.tRow}`} style={{ gridTemplateColumns:'1.8fr 1.4fr 0.7fr 0.9fr 1fr 1.2fr 0.9fr' }}>
                      <div><div style={{ fontWeight:500, fontSize:13 }}>{c.name}</div><div style={{ fontSize:11, color:'var(--t2)' }}>{c.email}</div></div>
                      <span style={{ fontSize:12, color:'var(--t2)' }}>{c.phone||'—'}</span>
                      <span style={{ fontWeight:600, color:'var(--bl)' }}>{c.total_orders}</span>
                      <span style={{ fontWeight:600, color:'var(--gr-d)' }}>₹{Math.round(c.total_spent)}</span>
                      <span style={{ fontSize:11, color:'var(--t2)' }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                      <span style={{ fontSize:11, color:'var(--t2)' }}>{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('en-IN') : '—'}</span>
                      <span>
                        {waDigits ? (
                          <button
                            onClick={() => window.open(`https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`, '_blank')}
                            title="WhatsApp pe message bhejo"
                            style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#25D366', color:'#fff', border:'none', borderRadius:8, padding:'5px 10px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                            🟢 Send
                          </button>
                        ) : <span style={{ fontSize:11, color:'var(--t3)' }}>—</span>}
                      </span>
                    </div>
                    )
                  })}
                </div>
              </div>
            </>
          )
        })()}

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
            {/* ── Branch-wise Analytics ── */}
            {branches.length > 0 && (
              <div style={{ background:'var(--card)', borderRadius:16, padding:'20px 24px', border:'1px solid var(--bd)', marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                  <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>🏪 Branch-wise Report</h3>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <input type="date" value={baDateFrom} onChange={e => setBaDateFrom(e.target.value)}
                      style={{ border:'1px solid var(--bd2)', borderRadius:6, padding:'5px 8px', fontSize:12, color:'var(--t1)', background:'var(--bg)' }} />
                    <span style={{ fontSize:12, color:'var(--t2)' }}>to</span>
                    <input type="date" value={baDateTo} onChange={e => setBaDateTo(e.target.value)}
                      style={{ border:'1px solid var(--bd2)', borderRadius:6, padding:'5px 8px', fontSize:12, color:'var(--t1)', background:'var(--bg)' }} />
                    <button className="btn btn-primary" style={{ fontSize:12 }}
                      onClick={async () => {
                        setBranchAnalyticsLoading(true)
                        const url = baDateFrom && baDateTo
                          ? `/api/admin?type=branch_analytics&date_from=${baDateFrom}&date_to=${baDateTo}`
                          : '/api/admin?type=branch_analytics'
                        const d = await fetch(url).then(r => r.json())
                        setBranchAnalytics(d)
                        setBranchAnalyticsLoading(false)
                      }}>
                      {branchAnalyticsLoading ? '⏳...' : '🔍 Load'}
                    </button>
                    {!branchAnalytics && (
                      <button className="btn btn-secondary" style={{ fontSize:12 }}
                        onClick={async () => {
                          setBranchAnalyticsLoading(true)
                          const d = await fetch('/api/admin?type=branch_analytics').then(r => r.json())
                          setBranchAnalytics(d)
                          setBranchAnalyticsLoading(false)
                        }}>
                        📊 Last 30 Days
                      </button>
                    )}
                  </div>
                </div>

                {!branchAnalytics ? (
                  <div style={{ textAlign:'center', padding:'30px', color:'var(--t3)', fontSize:13 }}>
                    "Load" ya "Last 30 Days" click karo report dekhne ke liye
                  </div>
                ) : branchAnalyticsLoading ? (
                  <div style={{ textAlign:'center', padding:30 }}><span className="spinner" /></div>
                ) : (
                  <>
                    {/* Branch comparison table */}
                    <div style={{ overflowX:'auto', marginBottom:20 }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ background:'var(--bg)' }}>
                            {['Branch','Orders','Delivered','Cancelled','Active','Revenue','Avg Order','Delivery Income'].map(h => (
                              <th key={h} style={{ padding:'8px 12px', textAlign: h==='Branch'?'left':'right', color:'var(--t2)', fontWeight:700, fontSize:11, textTransform:'uppercase', borderBottom:'1px solid var(--bd)', whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(branchAnalytics.stats || []).map((b, i) => {
                            const deliveredPct = b.total_orders > 0 ? Math.round(b.delivered / b.total_orders * 100) : 0
                            return (
                              <tr key={b.id} style={{ borderBottom:'1px solid var(--bd)', background: i%2===0?'var(--card)':'var(--bg)' }}>
                                <td style={{ padding:'10px 12px' }}>
                                  <div style={{ fontWeight:700, color:'var(--t1)' }}>{b.name}</div>
                                  {b.city && <div style={{ fontSize:10, color:'var(--t2)' }}>📍 {b.city}</div>}
                                  <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8, background: b.is_active?'#dcfce7':'#fee2e2', color: b.is_active?'#15803d':'#dc2626' }}>
                                    {b.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700 }}>{b.total_orders}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'#16a34a', fontWeight:700 }}>
                                  {b.delivered}
                                  <div style={{ fontSize:10, color:'var(--t2)' }}>{deliveredPct}%</div>
                                </td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color: b.cancelled>0?'#dc2626':'var(--t2)' }}>{b.cancelled}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color: b.active>0?'#f59e0b':'var(--t2)', fontWeight: b.active>0?700:400 }}>{b.active}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:'var(--or)' }}>₹{Math.round(parseFloat(b.revenue))}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'var(--t2)' }}>₹{Math.round(parseFloat(b.avg_order))}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'var(--t2)' }}>₹{Math.round(parseFloat(b.delivery_income))}</td>
                              </tr>
                            )
                          })}
                          {/* Total row */}
                          {(branchAnalytics.stats||[]).length > 1 && (() => {
                            const s = branchAnalytics.stats
                            return (
                              <tr style={{ borderTop:'2px solid var(--bd)', background:'var(--bg)', fontWeight:700 }}>
                                <td style={{ padding:'10px 12px', color:'var(--t1)' }}>📊 TOTAL</td>
                                <td style={{ padding:'10px 12px', textAlign:'right' }}>{s.reduce((a,b)=>a+b.total_orders,0)}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'#16a34a' }}>{s.reduce((a,b)=>a+b.delivered,0)}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'#dc2626' }}>{s.reduce((a,b)=>a+b.cancelled,0)}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'#f59e0b' }}>{s.reduce((a,b)=>a+b.active,0)}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'var(--or)' }}>₹{Math.round(s.reduce((a,b)=>a+parseFloat(b.revenue),0))}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right' }}>—</td>
                                <td style={{ padding:'10px 12px', textAlign:'right' }}>₹{Math.round(s.reduce((a,b)=>a+parseFloat(b.delivery_income),0))}</td>
                              </tr>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Top items per branch */}
                    {(branchAnalytics.stats||[]).map(b => {
                      const bItems = (branchAnalytics.topItems||[]).filter(t => t.branch_id === b.id).slice(0, 5)
                      if (!bItems.length) return null
                      const maxQty = bItems[0]?.qty || 1
                      return (
                        <div key={b.id} style={{ marginBottom:16, background:'var(--bg)', borderRadius:12, padding:'14px 16px' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)', marginBottom:10 }}>🏆 {b.name} — Top Items</div>
                          {bItems.map((item, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                              <span style={{ fontSize:11, fontWeight:700, color:'var(--t2)', minWidth:16 }}>#{i+1}</span>
                              <span style={{ fontSize:12, minWidth:120, color:'var(--t1)' }}>{item.name}</span>
                              <div style={{ flex:1, background:'var(--bd)', borderRadius:4, height:8 }}>
                                <div style={{ width:`${Math.round(item.qty/maxQty*100)}%`, height:'100%', background:'linear-gradient(90deg,#ff8c42,#e85d04)', borderRadius:4 }} />
                              </div>
                              <span style={{ fontSize:11, color:'var(--t2)', minWidth:30, textAlign:'right' }}>{item.qty} pcs</span>
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {/* 7-day daily trend per branch */}
                    {(branchAnalytics.dailyTrend||[]).length > 0 && (() => {
                      const branchIds = [...new Set((branchAnalytics.dailyTrend||[]).map(d => d.branch_id))]
                      const allDays = [...new Set((branchAnalytics.dailyTrend||[]).map(d => d.label))]
                      return (
                        <div style={{ background:'var(--bg)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)', marginBottom:12 }}>📈 Last 7 Days — Branch-wise Daily Revenue</div>
                          <div style={{ overflowX:'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                              <thead>
                                <tr>
                                  <th style={{ padding:'6px 10px', textAlign:'left', color:'var(--t2)', fontWeight:700 }}>Branch</th>
                                  {allDays.map(d => <th key={d} style={{ padding:'6px 10px', textAlign:'right', color:'var(--t2)', fontWeight:700, whiteSpace:'nowrap' }}>{d}</th>)}
                                  <th style={{ padding:'6px 10px', textAlign:'right', color:'var(--t2)', fontWeight:700 }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {branchIds.map(bid => {
                                  const br = (branchAnalytics.stats||[]).find(s => s.id === bid)
                                  if (!br) return null
                                  const rowData = allDays.map(day => {
                                    const found = branchAnalytics.dailyTrend.find(d => d.branch_id === bid && d.label === day)
                                    return found ? Math.round(parseFloat(found.revenue)) : 0
                                  })
                                  const rowTotal = rowData.reduce((a,b) => a+b, 0)
                                  return (
                                    <tr key={bid} style={{ borderTop:'1px solid var(--bd)' }}>
                                      <td style={{ padding:'7px 10px', fontWeight:600, color:'var(--t1)', whiteSpace:'nowrap' }}>{br.name}</td>
                                      {rowData.map((v, i) => (
                                        <td key={i} style={{ padding:'7px 10px', textAlign:'right', color: v>0?'var(--or)':'var(--t3)' }}>
                                          {v > 0 ? `₹${v}` : '—'}
                                        </td>
                                      ))}
                                      <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:'var(--or)' }}>₹{rowTotal}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            )}
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

        {/* ── ENGAGEMENT ── */}
        {section === 'engagement' && (
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>💌 Customer Engagement Messages</h2>
            <p style={{ fontSize:12, color:'var(--t2)', marginBottom:16 }}>Har category mein messages add/remove karo — app automatically random message choose karega</p>

            {/* Load button */}
            {!engagementData && (
              <button
                onClick={async () => {
                  setEngagementLoading(true)
                  const d = await fetch('/api/engagement').then(r => r.json())
                  setEngagementData(d.grouped || {})
                  const firstCat = Object.keys(d.grouped || {})[0]
                  if (firstCat) setEngagementCat(firstCat)
                  setEngagementLoading(false)
                }}
                disabled={engagementLoading}
                style={{ background:'var(--or)', color:'#fff', border:'none', borderRadius:10, padding:'10px 24px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                {engagementLoading ? '⏳ Load ho raha hai...' : '📂 Messages Load Karo'}
              </button>
            )}

            {engagementData && (
              <div>
                {/* Category tabs */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
                  {Object.entries(engagementData).map(([cat, { label }]) => (
                    <button key={cat} onClick={() => { setEngagementCat(cat); setEngagementNewMsg('') }}
                      style={{ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'1.5px solid', whiteSpace:'nowrap',
                        borderColor: engagementCat===cat ? 'var(--or)' : 'var(--bd)',
                        background: engagementCat===cat ? '#fff7ed' : 'var(--bg)',
                        color: engagementCat===cat ? 'var(--or)' : 'var(--t2)',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>

                {engagementCat && engagementData[engagementCat] && (() => {
                  const { label, messages } = engagementData[engagementCat]
                  return (
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                        <div style={{ fontSize:15, fontWeight:700 }}>{label}</div>
                        {/* Test send button */}
                        {engagementCat.endsWith('_notif') || engagementCat === 'miss_you' || engagementCat === 'friday' ? (
                          <button
                            disabled={!!testingNotif}
                            onClick={async () => {
                              const typeMap = { morning_notif:'morning', lunch_notif:'lunch', dinner_notif:'dinner', miss_you:'miss_you', friday:'friday' }
                              const t = typeMap[engagementCat]
                              if (!t) return
                              setTestingNotif(engagementCat)
                              await fetch(`/api/cron/notifications?type=${t}`).then(r => r.json())
                              setTestingNotif('')
                              setToast('Test notification bhej diya! ✅')
                              setTimeout(() => setToast(''), 3000)
                            }}
                            style={{ background:'#dcfce7', color:'#15803d', border:'1px solid #86efac', borderRadius:8, padding:'6px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                            {testingNotif === engagementCat ? '⏳ Bhej raha hai...' : '🧪 Test Send Karo'}
                          </button>
                        ) : null}
                      </div>

                      {/* Messages list */}
                      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                        {messages.length === 0 && (
                          <div style={{ fontSize:13, color:'var(--t2)', padding:'20px', textAlign:'center', background:'var(--bg)', borderRadius:10 }}>
                            Koi message nahi hai — neeche add karo 👇
                          </div>
                        )}
                        {messages.map(msg => (
                          <div key={msg.id} style={{ background:'var(--bg)', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'flex-start', gap:10,
                            border: msg.is_active ? '1.5px solid #d1fae5' : '1.5px solid var(--bd)', opacity: msg.is_active ? 1 : 0.55 }}>
                            <div style={{ flex:1, fontSize:13, color:'var(--t1)', lineHeight:1.55 }}>{msg.message}</div>
                            <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
                              {/* Toggle active */}
                              <button
                                onClick={async () => {
                                  await fetch('/api/engagement', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: msg.id, is_active: !msg.is_active }) })
                                  setEngagementData(prev => {
                                    const updated = { ...prev }
                                    updated[engagementCat] = { ...updated[engagementCat], messages: updated[engagementCat].messages.map(m => m.id === msg.id ? { ...m, is_active: !m.is_active } : m) }
                                    return updated
                                  })
                                }}
                                title={msg.is_active ? 'Disable karo' : 'Enable karo'}
                                style={{ background: msg.is_active ? '#dcfce7' : '#f3f4f6', color: msg.is_active ? '#15803d' : '#9ca3af', border:'none', borderRadius:8, padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                {msg.is_active ? '✅ Active' : '⏸ Off'}
                              </button>
                              {/* Delete */}
                              <button
                                onClick={async () => {
                                  if (!confirm('Delete karein?')) return
                                  await fetch('/api/engagement', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: msg.id }) })
                                  setEngagementData(prev => {
                                    const updated = { ...prev }
                                    updated[engagementCat] = { ...updated[engagementCat], messages: updated[engagementCat].messages.filter(m => m.id !== msg.id) }
                                    return updated
                                  })
                                }}
                                style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:8, padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                🗑
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add new message */}
                      <div style={{ background:'var(--card)', border:'1.5px dashed var(--bd2)', borderRadius:14, padding:'16px' }}>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:'var(--t1)' }}>➕ Naya Message Add Karo</div>
                        <textarea
                          value={engagementNewMsg}
                          onChange={e => setEngagementNewMsg(e.target.value)}
                          placeholder="Yahan message likhein... (emoji bhi use kar sakte hain 😄)"
                          rows={3}
                          style={{ width:'100%', padding:'10px 12px', border:'1.5px solid var(--bd)', borderRadius:10, fontSize:13, resize:'vertical', background:'var(--bg)', color:'var(--t1)', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.5 }}
                        />
                        <button
                          disabled={!engagementNewMsg.trim() || engagementSaving}
                          onClick={async () => {
                            if (!engagementNewMsg.trim()) return
                            setEngagementSaving(true)
                            const d = await fetch('/api/engagement', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ category: engagementCat, message: engagementNewMsg.trim() }) }).then(r => r.json())
                            if (d.success) {
                              setEngagementData(prev => {
                                const updated = { ...prev }
                                updated[engagementCat] = { ...updated[engagementCat], messages: [...updated[engagementCat].messages, d.message] }
                                return updated
                              })
                              setEngagementNewMsg('')
                              setToast('Message add ho gaya! ✅')
                              setTimeout(() => setToast(''), 2500)
                            }
                            setEngagementSaving(false)
                          }}
                          style={{ marginTop:10, background: engagementNewMsg.trim() ? 'var(--or)' : '#d1d5db', color:'#fff', border:'none', borderRadius:10, padding:'10px 24px', fontSize:13, fontWeight:700, cursor: engagementNewMsg.trim() ? 'pointer' : 'not-allowed' }}>
                          {engagementSaving ? '⏳ Saving...' : '💾 Add Karo'}
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}



      {/* ── Branch Inventory Modal (top-level so vendors can open it too) ── */}
          {/* ── Branch Inventory Modal ── */}
          {showInventory && inventoryBranch && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
              onClick={e => { if (e.target === e.currentTarget) setShowInventory(false) }}>
              <div style={{ background:'var(--card)', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:560, maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
                {/* Header */}
                <div style={{ padding:'20px 20px 14px', borderBottom:'1px solid var(--bd)', flexShrink:0 }}>
                  <div style={{ width:40, height:4, background:'var(--bd2)', borderRadius:4, margin:'0 auto 16px' }} />
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)' }}>📦 {inventoryBranch.name} — Menu</div>
                      <div style={{ fontSize:12, color:'var(--t2)', marginTop:2 }}>Is branch ka apna price + stock + on/off. Price blank = master rate. Stock blank = ∞ (no limit)</div>
                    </div>
                    <button className="btn btn-secondary" style={{ fontSize:11 }} onClick={() => setShowInventory(false)}>✕ Close</button>
                  </div>
                  {/* Search */}
                  <input
                    value={inventorySearch} onChange={e => setInventorySearch(e.target.value)}
                    placeholder="🔍 Item search karo..."
                    style={{ width:'100%', padding:'9px 12px', border:'0.5px solid var(--bd2)', borderRadius:8, background:'var(--bg)', color:'var(--t1)', fontSize:13, outline:'none', boxSizing:'border-box' }}
                  />
                  {/* Bulk actions */}
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    <button className="btn btn-secondary" style={{ flex:1, fontSize:11 }}
                      onClick={async () => {
                        await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'branch_inventory', action:'bulk', branch_id:inventoryBranch.id, is_available:true }) })
                        setInventoryItems(prev => prev.map(x => ({...x, branch_available:true})))
                        showToast('✅ Sab items enable kar diye')
                      }}>✅ Sab Enable</button>
                    <button className="btn btn-secondary" style={{ flex:1, fontSize:11 }}
                      onClick={async () => {
                        await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'branch_inventory', action:'bulk', branch_id:inventoryBranch.id, is_available:false }) })
                        setInventoryItems(prev => prev.map(x => ({...x, branch_available:false})))
                        showToast('🔴 Sab items disable kar diye')
                      }}>🔴 Sab Disable</button>
                  </div>
                  {/* Phase 4 — this branch's OWN item */}
                  <button className="btn btn-secondary" style={{ width:'100%', marginTop:8, fontSize:12, color:'#16a34a', borderColor:'#16a34a' }}
                    onClick={() => { setBranchNewItem({ name:'', category:'', price:'', stock_count:'', is_veg:true, description:'' }); setShowBranchAddItem(v => !v) }}>
                    {showBranchAddItem ? '✕ Cancel' : '➕ Is branch ka apna item add karo'}
                  </button>
                  {showBranchAddItem && (
                    <div style={{ marginTop:10, padding:12, border:'1px solid var(--bd2)', borderRadius:10, background:'var(--bg)' }}>
                      <div style={{ fontSize:11, color:'var(--t2)', marginBottom:8 }}>Ye item <strong>sirf {inventoryBranch.name}</strong> me dikhega (master menu me nahi).</div>
                      <input value={branchNewItem.name} onChange={e => setBranchNewItem(p => ({...p, name:e.target.value}))} placeholder="Item ka naam *"
                        style={{ width:'100%', padding:'8px 10px', marginBottom:6, border:'1px solid var(--bd2)', borderRadius:7, background:'var(--card)', color:'var(--t1)', fontSize:13, boxSizing:'border-box' }} />
                      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                        <input value={branchNewItem.category} onChange={e => setBranchNewItem(p => ({...p, category:e.target.value}))} placeholder="Category *"
                          style={{ flex:1, padding:'8px 10px', border:'1px solid var(--bd2)', borderRadius:7, background:'var(--card)', color:'var(--t1)', fontSize:13, boxSizing:'border-box' }} />
                        <input type="number" min="0" value={branchNewItem.price} onChange={e => setBranchNewItem(p => ({...p, price:e.target.value}))} placeholder="₹ Price *"
                          style={{ width:90, padding:'8px 10px', border:'1px solid var(--bd2)', borderRadius:7, background:'var(--card)', color:'var(--t1)', fontSize:13, boxSizing:'border-box' }} />
                        <input type="number" min="0" value={branchNewItem.stock_count} onChange={e => setBranchNewItem(p => ({...p, stock_count:e.target.value}))} placeholder="Stock"
                          style={{ width:70, padding:'8px 10px', border:'1px solid var(--bd2)', borderRadius:7, background:'var(--card)', color:'var(--t1)', fontSize:13, boxSizing:'border-box' }} />
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                        <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--t2)', cursor:'pointer' }}>
                          <input type="radio" checked={branchNewItem.is_veg} onChange={() => setBranchNewItem(p => ({...p, is_veg:true}))} /> 🟢 Veg
                        </label>
                        <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--t2)', cursor:'pointer' }}>
                          <input type="radio" checked={!branchNewItem.is_veg} onChange={() => setBranchNewItem(p => ({...p, is_veg:false}))} /> 🔴 Non-veg
                        </label>
                      </div>
                      <button className="btn btn-primary" style={{ width:'100%', fontSize:13 }} disabled={branchItemSaving}
                        onClick={async () => {
                          if (!branchNewItem.name.trim() || !branchNewItem.category.trim() || branchNewItem.price === '') { showToast('❌ Naam, category, price bharo'); return }
                          setBranchItemSaving(true)
                          try {
                            const res = await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'},
                              body:JSON.stringify({ type:'branch_inventory', action:'add_item', branch_id:inventoryBranch.id, ...branchNewItem }) })
                            const d = await res.json()
                            if (!res.ok) { showToast('❌ ' + (d.error || 'Fail')); }
                            else { showToast('✅ Item add ho gaya'); setShowBranchAddItem(false); await reloadInventory(inventoryBranch.id) }
                          } catch { showToast('❌ Network error') }
                          setBranchItemSaving(false)
                        }}>{branchItemSaving ? 'Adding…' : '✅ Add to ' + inventoryBranch.name}</button>
                    </div>
                  )}
                </div>

                {/* Items list */}
                <div style={{ overflowY:'auto', flex:1, padding:'12px 20px 32px' }}>
                  {inventoryLoading ? (
                    <div style={{ textAlign:'center', padding:40 }}><span className="spinner" /></div>
                  ) : (() => {
                    const filtered = inventoryItems.filter(it =>
                      !inventorySearch || it.name.toLowerCase().includes(inventorySearch.toLowerCase()) || it.category.toLowerCase().includes(inventorySearch.toLowerCase())
                    )
                    const categories = [...new Set(filtered.map(it => it.category))]
                    if (filtered.length === 0) return <div style={{ textAlign:'center', padding:40, color:'var(--t3)' }}>Koi item nahi mila</div>
                    return categories.map(cat => (
                      <div key={cat} style={{ marginBottom:20 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8, paddingBottom:6, borderBottom:'1px solid var(--bd)' }}>
                          {cat} ({filtered.filter(x => x.category===cat).length})
                        </div>
                        {filtered.filter(x => x.category===cat).map(item => {
                          const priceOverridden = item.branch_price != null && Number(item.branch_price) !== Number(item.master_price)
                          const isOwned = item.owner_branch_id && item.owner_branch_id === inventoryBranch.id
                          return (
                          <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--bd)' }}>
                            {item.image_url && <img src={item.image_url} alt="" style={{ width:40, height:40, borderRadius:8, objectFit:'cover', flexShrink:0 }} />}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:600, color: item.branch_available ? 'var(--t1)' : 'var(--t3)', display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ width:7, height:7, borderRadius:'50%', background: item.is_veg ? 'var(--gr)' : 'var(--rd)', flexShrink:0, display:'inline-block' }} />
                                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</span>
                                {isOwned && <span style={{ fontSize:9, fontWeight:700, color:'#16a34a', background:'#dcfce7', padding:'1px 5px', borderRadius:5, flexShrink:0 }}>🏠 OWN</span>}
                              </div>
                              <div style={{ fontSize:10, color:'var(--t3)' }}>{isOwned ? 'sirf is branch ka item' : `master ₹${item.master_price}`}</div>
                            </div>

                            {/* Per-branch price */}
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, flexShrink:0 }}>
                              <span style={{ fontSize:9, color:'var(--t3)', fontWeight:600 }}>PRICE</span>
                              <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                                <span style={{ fontSize:12, color:'var(--t2)' }}>₹</span>
                                <input
                                  type="number" min="0" inputMode="numeric"
                                  defaultValue={item.branch_price ?? ''}
                                  placeholder={String(item.master_price)}
                                  onBlur={async (e) => {
                                    const v = e.target.value
                                    const num = v === '' ? null : Number(v)
                                    if (num === Number(item.branch_price)) return
                                    setInventoryItems(prev => prev.map(x => x.id===item.id ? {...x, branch_price: (num==null? item.master_price : num)} : x))
                                    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'},
                                      body:JSON.stringify({ type:'branch_inventory', action:'set_price', branch_id:inventoryBranch.id, item_id:item.id, price: num }) })
                                  }}
                                  style={{ width:52, padding:'4px 6px', fontSize:13, textAlign:'center', borderRadius:6, border:`1px solid ${priceOverridden ? 'var(--or)' : 'var(--bd2)'}`, background:'var(--bg)', color: priceOverridden ? 'var(--or)' : 'var(--t1)', fontWeight: priceOverridden ? 700 : 400 }}
                                />
                              </div>
                            </div>

                            {/* Per-branch stock */}
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, flexShrink:0 }}>
                              <span style={{ fontSize:9, color:'var(--t3)', fontWeight:600 }}>STOCK</span>
                              <input
                                type="number" min="0" inputMode="numeric"
                                defaultValue={item.branch_stock ?? ''}
                                placeholder="∞"
                                onBlur={async (e) => {
                                  const v = e.target.value
                                  const num = v === '' ? null : Math.trunc(Number(v))
                                  if (num === (item.branch_stock ?? null)) return
                                  setInventoryItems(prev => prev.map(x => x.id===item.id ? {...x, branch_stock: num} : x))
                                  await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'},
                                    body:JSON.stringify({ type:'branch_inventory', action:'set_stock', branch_id:inventoryBranch.id, item_id:item.id, stock_count: num }) })
                                }}
                                style={{ width:46, padding:'4px 6px', fontSize:13, textAlign:'center', borderRadius:6, border:`1px solid ${item.branch_stock!=null && item.branch_stock<=0 ? 'var(--rd)' : 'var(--bd2)'}`, background:'var(--bg)', color: item.branch_stock!=null && item.branch_stock<=0 ? 'var(--rd)' : 'var(--t1)' }}
                              />
                            </div>

                            {/* Toggle switch */}
                            <div
                              onClick={async () => {
                                const newVal = !item.branch_available
                                setInventoryItems(prev => prev.map(x => x.id===item.id ? {...x, branch_available:newVal} : x))
                                await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'},
                                  body:JSON.stringify({ type:'branch_inventory', action:'toggle', branch_id:inventoryBranch.id, item_id:item.id, is_available:newVal }) })
                              }}
                              style={{ width:44, height:26, borderRadius:13, background: item.branch_available ? 'var(--gr)' : 'var(--bd2)', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                              <div style={{ position:'absolute', width:20, height:20, background:'#fff', borderRadius:'50%', top:3, left: item.branch_available ? 21 : 3, transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }} />
                            </div>

                            {/* Delete — only for this branch's OWN items */}
                            {isOwned && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`"${item.name}" delete kare? Ye permanently hat jayega.`)) return
                                  const res = await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'},
                                    body:JSON.stringify({ type:'branch_inventory', action:'delete_item', branch_id:inventoryBranch.id, item_id:item.id }) })
                                  if (res.ok) { setInventoryItems(prev => prev.filter(x => x.id !== item.id)); showToast('🗑 Item delete ho gaya') }
                                  else { const d = await res.json(); showToast('❌ ' + (d.error || 'Fail')) }
                                }}
                                title="Delete"
                                style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, flexShrink:0, padding:'2px 4px', color:'var(--rd)' }}>🗑</button>
                            )}
                          </div>
                          )
                        })}
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </div>
          )}

      {/* ══════════════════════════════════════════════════════════
          BRANCHES TAB
      ══════════════════════════════════════════════════════════ */}
      {section === 'branches' && (
        <div style={{ padding: '0 0 40px' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)' }}>🏪 Branches</div>
              <div style={{ fontSize:12, color:'var(--t2)', marginTop:2 }}>{branches.length} branch{branches.length !== 1 ? 'es' : ''} registered</div>
            </div>
            <button className="btn btn-primary" onClick={() => { setShowAddBranch(true); setEditBranch(null); setNewBranch(emptyBranch) }}>
              + New Branch
            </button>
          </div>

          {/* Branch Cards */}
          {branches.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--t3)' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🏪</div>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--t2)' }}>Koi branch nahi hai abhi</div>
              <div style={{ fontSize:13, marginTop:6 }}>New Branch button se pehli branch create karo</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16 }}>
              {branches.map(b => (
                <div key={b.id} className="card" style={{ borderLeft:`4px solid ${b.is_active ? 'var(--gr)' : 'var(--rd)'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        {b.name}
                        {b.type === 'partner' && <span style={{ fontSize:9, fontWeight:700, color:'#7c3aed', background:'#ede9fe', padding:'2px 6px', borderRadius:5 }}>🤝 PARTNER</span>}
                      </div>
                      {b.city && <div style={{ fontSize:11, color:'var(--t2)', marginTop:2 }}>📍 {b.city}</div>}
                    </div>
                    <span style={{
                      fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                      background: b.is_active ? 'var(--gr-l)' : 'var(--rd-l)',
                      color: b.is_active ? 'var(--gr-d)' : 'var(--rd)',
                    }}>{b.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  {b.type === 'partner' && Number(b.commission_percent) > 0 && (
                    <div style={{ fontSize:12, color:'#7c3aed', marginBottom:6, fontWeight:600 }}>💰 Commission: {b.commission_percent}%</div>
                  )}
                  {b.address && <div style={{ fontSize:12, color:'var(--t2)', marginBottom:6, lineHeight:1.5 }}>🏠 {b.address}</div>}
                  {b.phone && <div style={{ fontSize:12, color:'var(--t2)', marginBottom:6 }}>📞 {b.phone}</div>}
                  <div style={{ fontSize:12, color:'var(--t3)', marginBottom:4 }}>🕐 {b.opening_time} – {b.closing_time}</div>
                  <div style={{ fontSize:12, color:'var(--t3)', marginBottom:12 }}>📦 Delivery Radius: <strong>{b.max_delivery_km ? `${b.max_delivery_km} km` : 'Global setting'}</strong></div>
                  {b.lat && b.lng && (
                    <div style={{ marginBottom:12 }}>
                      <a href={`https://maps.google.com/?q=${b.lat},${b.lng}`} target="_blank" rel="noreferrer"
                        style={{ fontSize:12, color:'var(--bl)', fontWeight:600 }}>🗺️ Map pe dekho</a>
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-secondary" style={{ flex:1, fontSize:12 }}
                      onClick={() => { setEditBranch(b); setNewBranch({ name:b.name, address:b.address||'', city:b.city||'', phone:b.phone||'', lat:b.lat||'', lng:b.lng||'', opening_time:b.opening_time||'09:00', closing_time:b.closing_time||'22:00', max_delivery_km: parseFloat(b.max_delivery_km) > 0 ? parseFloat(b.max_delivery_km) : '', type: b.type || 'own', commission_percent: (b.commission_percent != null && Number(b.commission_percent) > 0) ? b.commission_percent : '' }); setShowAddBranch(true) }}>
                      ✏️ Edit
                    </button>
                    <button className="btn btn-secondary" style={{ flex:1, fontSize:12 }}
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'branch', action:'toggle', id:b.id }) })
                          const d = await res.json()
                          if (!res.ok) { showToast('❌ ' + (d.error || 'Error hua')); return }
                          setBranches(prev => prev.map(x => x.id === b.id ? { ...x, is_active: d.branch?.is_active ?? !x.is_active } : x))
                          showToast(d.branch?.is_active ? '✅ Branch activate ki' : '🔴 Branch deactivate ki')
                        } catch { showToast('❌ Network error') }
                      }}>
                      {b.is_active ? '🔴 Deactivate' : '✅ Activate'}
                    </button>
                  </div>
                  <button className="btn btn-secondary" style={{ width:'100%', marginTop:8, fontSize:12 }}
                    onClick={async () => {
                      setInventoryBranch(b); setShowInventory(true); setInventorySearch('')
                      setInventoryLoading(true)
                      const res = await fetch(`/api/admin?type=branch_inventory&branch_id=${b.id}`)
                      const d = await res.json()
                      setInventoryItems(d.items || [])
                      setInventoryLoading(false)
                    }}>
                    📦 Inventory Manage Karo
                  </button>
                  <button className="btn btn-secondary" style={{ width:'100%', marginTop:8, fontSize:12, color:'#7c3aed', borderColor:'#7c3aed' }}
                    onClick={() => { setBranchLoginTarget(b); setBranchLoginPhone(''); setBranchLoginPass(''); setShowBranchLogin(true) }}>
                    🔐 Branch Login Set Karo
                  </button>
                </div>
              ))}
            </div>
          )}


          {/* ── Branch Login Modal ── */}
          {showBranchLogin && branchLoginTarget && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
              onClick={e => { if (e.target === e.currentTarget) setShowBranchLogin(false) }}>
              <div style={{ background:'var(--card)', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, padding:'28px 20px 48px' }}>
                <div style={{ width:40, height:4, background:'var(--bd2)', borderRadius:4, margin:'0 auto 20px' }} />
                <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)', marginBottom:6 }}>🔐 Branch Login Set Karo</div>
                <div style={{ fontSize:12, color:'var(--t2)', marginBottom:20 }}>
                  <b>{branchLoginTarget.name}</b> ke liye executive login credentials set karo
                </div>
                <div className="field">
                  <label>Phone Number (Login ID)</label>
                  <input
                    value={branchLoginPhone}
                    onChange={e => setBranchLoginPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    type="tel"
                  />
                </div>
                <div className="field">
                  <label>Password (min 6 characters)</label>
                  <input
                    value={branchLoginPass}
                    onChange={e => setBranchLoginPass(e.target.value)}
                    placeholder="Strong password set karo"
                    type="password"
                  />
                </div>
                <div style={{ background:'#fef3c7', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#92400e', marginBottom:16 }}>
                  ⚠️ Is phone + password se branch executive login karega aur sirf <b>{branchLoginTarget.name}</b> ke orders dekhega
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowBranchLogin(false)}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex:2, background:'#7c3aed' }}
                    disabled={!branchLoginPhone.trim() || branchLoginPass.length < 6 || branchLoginSaving}
                    onClick={async () => {
                      setBranchLoginSaving(true)
                      try {
                        const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'},
                          body: JSON.stringify({ action:'set-branch-login', branch_id: branchLoginTarget.id, phone: branchLoginPhone.trim(), password: branchLoginPass, name: branchLoginTarget.name + ' Executive' }) })
                        const d = await res.json()
                        if (!res.ok) { showToast('❌ ' + (d.error || 'Error')); return }
                        showToast('✅ Branch login set ho gaya!')
                        setShowBranchLogin(false)
                      } catch { showToast('❌ Kuch gadbad ho gayi') }
                      finally { setBranchLoginSaving(false) }
                    }}>
                    {branchLoginSaving ? '⏳ Saving...' : '🔐 Set Login'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add / Edit Branch Modal */}
          {showAddBranch && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
              onClick={e => { if (e.target === e.currentTarget) setShowAddBranch(false) }}>
              <div style={{ background:'var(--card)', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:520, padding:'24px 20px 40px', maxHeight:'90vh', overflowY:'auto' }}>
                <div style={{ width:40, height:4, background:'var(--bd2)', borderRadius:4, margin:'0 auto 20px' }} />
                <div style={{ fontSize:17, fontWeight:800, color:'var(--t1)', marginBottom:20 }}>
                  {editBranch ? '✏️ Branch Edit Karo' : '🏪 Naya Branch / Vendor'}
                </div>

                {/* Own outlet vs externally-onboarded partner vendor */}
                <div className="field">
                  <label>Type</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {[['own','🏠 Apna Outlet'],['partner','🤝 Partner Vendor']].map(([val,lbl]) => (
                      <button key={val} type="button"
                        onClick={() => setNewBranch(p => ({...p, type:val, ...(val==='own' ? { commission_percent:'' } : {})}))}
                        style={{ flex:1, padding:'10px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer',
                          border:`1.5px solid ${newBranch.type===val ? '#e85d04' : 'var(--bd2)'}`,
                          background: newBranch.type===val ? '#fff7ed' : 'var(--bg)',
                          color: newBranch.type===val ? '#e85d04' : 'var(--t2)' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {newBranch.type==='partner' && (
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:6 }}>
                      Partner = bahar ka restaurant/dhaba/vendor jise aap hygiene etc. verify karke khud onboard kar rahe ho. Customer ko bas "branch" dikhega.
                    </div>
                  )}
                </div>

                {newBranch.type==='partner' && (
                  <div className="field">
                    <label>Commission % (FoodFi ka cut)</label>
                    <input type="number" min="0" max="100" value={newBranch.commission_percent}
                      onChange={e => setNewBranch(p => ({...p, commission_percent:e.target.value}))}
                      placeholder="e.g. 15" />
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Har order pe vendor ki sale ka itna % FoodFi rakhega (settlement ke liye record).</div>
                  </div>
                )}

                <div className="field">
                  <label>{newBranch.type==='partner' ? 'Vendor / Restaurant Name *' : 'Branch Name *'}</label>
                  <input value={newBranch.name} onChange={e => setNewBranch(p => ({...p, name:e.target.value}))} placeholder={newBranch.type==='partner' ? 'e.g. Sharma Ji Dhaba' : 'e.g. FoodFi Patna Central'} />
                </div>
                <div className="field">
                  <label>City</label>
                  <input value={newBranch.city} onChange={e => setNewBranch(p => ({...p, city:e.target.value}))} placeholder="e.g. Patna" />
                </div>
                <div className="field">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <label style={{ margin:0 }}>Full Address</label>
                    <button type="button"
                      onClick={() => setShowBranchMap(true)}
                      style={{ fontSize:11, fontWeight:700, color:'var(--or)', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:8, padding:'3px 10px', cursor:'pointer' }}>
                      🗺️ Map se Select Karo
                    </button>
                  </div>
                  <textarea value={newBranch.address} onChange={e => setNewBranch(p => ({...p, address:e.target.value}))} placeholder="Map se select karo ya manually type karo..." rows={2} />
                  {newBranch.lat && newBranch.lng && (
                    <div style={{ fontSize:11, color:'var(--gr)', marginTop:4 }}>📍 {parseFloat(newBranch.lat).toFixed(6)}, {parseFloat(newBranch.lng).toFixed(6)}</div>
                  )}
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input value={newBranch.phone} onChange={e => setNewBranch(p => ({...p, phone:e.target.value}))} placeholder="+91 XXXXX XXXXX" />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="field">
                    <label>Opening Time</label>
                    <input type="time" value={newBranch.opening_time} onChange={e => setNewBranch(p => ({...p, opening_time:e.target.value}))} />
                  </div>
                  <div className="field">
                    <label>Closing Time</label>
                    <input type="time" value={newBranch.closing_time} onChange={e => setNewBranch(p => ({...p, closing_time:e.target.value}))} />
                  </div>
                </div>
                <div className="field">
                  <label>Max Delivery Radius (KM)</label>
                  <input
                    type="number" min="0.5" max="50" step="0.5"
                    value={newBranch.max_delivery_km}
                    onChange={e => setNewBranch(p => ({...p, max_delivery_km:e.target.value}))}
                    placeholder={`Default: Kitchen Settings se (global)`}
                  />
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Khali chodo to Kitchen Settings wala global radius use hoga</div>
                </div>

                {/* GPS Location */}
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>GPS Coordinates (auto-fill from map)</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={newBranch.lat} onChange={e => setNewBranch(p => ({...p, lat:e.target.value}))} placeholder="Latitude" style={{ flex:1, padding:'10px 12px', border:'0.5px solid var(--bd2)', borderRadius:8, background:'var(--bg)', color:'var(--t1)', fontSize:13, outline:'none' }} />
                    <input value={newBranch.lng} onChange={e => setNewBranch(p => ({...p, lng:e.target.value}))} placeholder="Longitude" style={{ flex:1, padding:'10px 12px', border:'0.5px solid var(--bd2)', borderRadius:8, background:'var(--bg)', color:'var(--t1)', fontSize:13, outline:'none' }} />
                  </div>
                </div>

                <div style={{ display:'flex', gap:10, marginTop:4 }}>
                  <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowAddBranch(false)}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex:2 }} disabled={!newBranch.name.trim() || branchSaving}
                    onClick={async () => {
                      setBranchSaving(true)
                      try {
                        const payload = editBranch
                          // newBranch.type is the vendor type (own/partner) — send it as
                          // branch_type so it doesn't clash with the API routing `type`.
                          ? { ...newBranch, type:'branch', branch_type:newBranch.type, action:'update', id:editBranch.id }
                          : { ...newBranch, type:'branch', branch_type:newBranch.type, action:'create' }
                        const res = await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
                        const d = await res.json()
                        if (!res.ok) { showToast('❌ ' + (d.error || 'Error')); return }
                        if (editBranch) {
                          setBranches(prev => prev.map(x => x.id === d.branch.id ? d.branch : x))
                          showToast('✅ Branch update ho gayi!')
                        } else {
                          setBranches(prev => [...prev, d.branch])
                          showToast('✅ Naya branch create ho gaya!')
                        }
                        setShowAddBranch(false)
                        setNewBranch(emptyBranch)
                        setEditBranch(null)
                      } catch { showToast('❌ Kuch gadbad ho gayi') }
                      finally { setBranchSaving(false) }
                    }}>
                    {branchSaving ? '⏳ Saving...' : editBranch ? '💾 Update Branch' : '🏪 Create Branch'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
                  <a href={(orderDetail.delivery_lat && orderDetail.delivery_lng)
                      ? `https://www.google.com/maps/search/?api=1&query=${orderDetail.delivery_lat},${orderDetail.delivery_lng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orderDetail.delivery_address || '')}`}
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
            {orderDetail.branch_name && (
              <div style={{ marginTop:10, fontSize:12, color:'#7c3aed', fontWeight:600, background:'#ede9fe', borderRadius:8, padding:'6px 10px', display:'inline-block' }}>🏪 Branch: {orderDetail.branch_name}</div>
            )}
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
              <div className="field">
                <label>Delivery Address</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input required value={manualOrder.address} onChange={e => setManualOrder({...manualOrder, address:e.target.value})} placeholder="Pura address daalo" style={{ flex:1 }} />
                  <button type="button" onClick={() => setShowPhoneMap(true)}
                    style={{ whiteSpace:'nowrap', padding:'8px 12px', background:(manualOrder.lat&&manualOrder.lng)?'#dcfce7':'var(--bl-l)', color:(manualOrder.lat&&manualOrder.lng)?'#16a34a':'var(--bl)', border:'1px solid '+((manualOrder.lat&&manualOrder.lng)?'#16a34a':'var(--bl)'), borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    {manualOrder.lat&&manualOrder.lng ? '✅ Location' : '🗺️ Map'}
                  </button>
                </div>
                {manualOrder.lat&&manualOrder.lng
                  ? <div style={{ fontSize:11, color:'var(--gr-d)', marginTop:3 }}>📍 Exact location set — delivery boy seedha yahan navigate karega</div>
                  : <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>💡 Map se location select karo taaki exact pe deliver ho (warna address text se confusion ho sakti hai)</div>}
              </div>
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

      {/* ── Phone Order Location Picker ─────────────────────────── */}
      {showPhoneMap && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:10002, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
          <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:560, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px #0008' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--bd)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>🗺️ Customer Location Select Karo</div>
                <div style={{ fontSize:11, color:'var(--t2)', marginTop:2 }}>Address search karo, map pe click ya pin drag karo</div>
              </div>
              <button onClick={() => { setShowPhoneMap(false); phoneMapInstRef.current = null }} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--t2)' }}>✕</button>
            </div>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bd)' }}>
              <input ref={phoneSearchRef} placeholder="🔍 Address search karo (e.g. Sneha Sadan, Subash Nagar, Patna)..." style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', border:'1.5px solid var(--bd2)', borderRadius:10, fontSize:13, outline:'none', background:'var(--bg)', color:'var(--t1)' }} />
            </div>
            <div ref={(el) => {
              phoneMapRef.current = el
              if (!el || phoneMapInstRef.current) return
              loadGoogleMaps().then(gmaps => {
                if (!phoneMapRef.current) return
                const initLat = parseFloat(manualOrder.lat) || 25.5943
                const initLng = parseFloat(manualOrder.lng) || 85.1376
                const map = new gmaps.Map(phoneMapRef.current, {
                  center: { lat: initLat, lng: initLng },
                  zoom: manualOrder.lat ? 16 : 13,
                  mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
                  zoomControlOptions: { position: gmaps.ControlPosition.RIGHT_CENTER }
                })
                phoneMapInstRef.current = map
                const marker = new gmaps.Marker({ position: { lat: initLat, lng: initLng }, map, draggable: true, title: 'Customer location', animation: gmaps.Animation.DROP, visible: !!manualOrder.lat })
                phoneMarkerRef.current = marker
                const onPick = (lat, lng) => {
                  marker.setVisible(true)
                  setManualOrder(p => ({ ...p, lat: lat.toFixed(8), lng: lng.toFixed(8) }))
                  reverseGeocodeAdmin(lat, lng).then(addr => { if (addr) setManualOrder(p => ({ ...p, address: addr })) })
                }
                marker.addListener('dragend', () => { const pos = marker.getPosition(); onPick(pos.lat(), pos.lng()) })
                map.addListener('click', e => { marker.setPosition(e.latLng); onPick(e.latLng.lat(), e.latLng.lng()) })
                if (phoneSearchRef.current) {
                  const ac = new gmaps.places.Autocomplete(phoneSearchRef.current, { componentRestrictions: { country: 'in' }, fields: ['formatted_address', 'geometry'] })
                  ac.addListener('place_changed', () => {
                    const place = ac.getPlace()
                    if (!place.geometry) return
                    const loc = place.geometry.location
                    map.setCenter(loc); map.setZoom(17)
                    marker.setPosition(loc); marker.setVisible(true)
                    setManualOrder(p => ({ ...p, lat: loc.lat().toFixed(8), lng: loc.lng().toFixed(8), address: place.formatted_address || p.address }))
                  })
                }
              })
            }} style={{ flex:1, minHeight:320 }} />
            <div style={{ padding:'12px 14px', borderTop:'1px solid var(--bd)', background:'var(--card)' }}>
              {manualOrder.lat && manualOrder.lng
                ? <div style={{ fontSize:12, color:'var(--gr-d)', marginBottom:10 }}>✅ {parseFloat(manualOrder.lat).toFixed(6)}, {parseFloat(manualOrder.lng).toFixed(6)}{manualOrder.address && <span style={{ color:'var(--t2)', marginLeft:6 }}>· {manualOrder.address.slice(0,50)}</span>}</div>
                : <div style={{ fontSize:12, color:'var(--t3)', marginBottom:10 }}>📍 Address search karo ya map pe click karo</div>}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => { setShowPhoneMap(false); phoneMapInstRef.current = null }} style={{ flex:1, padding:'10px', background:'var(--bg)', border:'1px solid var(--bd2)', borderRadius:10, fontSize:13, cursor:'pointer' }}>Cancel</button>
                <button disabled={!manualOrder.lat || !manualOrder.lng} onClick={() => { setShowPhoneMap(false); phoneMapInstRef.current = null; showToast('📍 Location set ho gaya!') }} style={{ flex:2, padding:'10px', background:(!manualOrder.lat || !manualOrder.lng)?'#d1d5db':'var(--or)', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:(!manualOrder.lat || !manualOrder.lng)?'not-allowed':'pointer' }}>✅ Ye Location Use Karo</button>
              </div>
            </div>
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
                <div style={{ fontSize:12, color:'var(--t2)', background:'var(--bg)', padding:'10px 12px', borderRadius:8, lineHeight:1.5 }}>
                  💡 Delivery payout ab <b>centralized</b> hai — sabke liye ek hi rate <b>Kitchen Settings → 🛵 Delivery Boy Payout</b> se set hota hai (per-boy rate hata diya).
                </div>
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
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                  {[
                    { label:'Customer Paid', val:`₹${Math.round(parseFloat(payoutData.summary?.total_collected||0))}`, color:'#2563eb', bg:'#dbeafe' },
                    { label:'Boy Payout', val:`₹${Math.round(parseFloat(payoutData.summary?.total_to_pay||0))}`, color:'#16a34a', bg:'#dcfce7' },
                    { label:'Already Paid', val:`₹${Math.round(parseFloat(payoutData.summary?.total_paid||0))}`, color:'#7c3aed', bg:'#f5f3ff' },
                    parseFloat(payoutData.summary?.over_paid||0) > 0
                      ? { label:'Over-Paid ⚠️', val:`₹${Math.round(parseFloat(payoutData.summary.over_paid))}`, color:'#b45309', bg:'#fef3c7' }
                      : { label:'Balance Due', val:`₹${Math.round(parseFloat(payoutData.summary?.balance_due||0))}`, color:'#dc2626', bg:'#fef2f2' },
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} style={{ background:bg, borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3, fontWeight:600 }}>{label}</div>
                      <div style={{ fontSize:15, fontWeight:800, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Over-paid warning */}
                {parseFloat(payoutData.summary?.over_paid||0) > 0 && (
                  <div style={{ background:'#fef3c7', border:'1.5px solid #fbbf24', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#92400e', fontWeight:600 }}>
                    ⚠️ Over-paid: ₹{Math.round(parseFloat(payoutData.summary.over_paid))} zyada de diya — agle payment se adjust karo
                  </div>
                )}

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


      {/* ── Branch Map Picker Modal ───────────────────────────── */}
      {showBranchMap && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:10001, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
          <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:560, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px #0008' }}>
            {/* Header */}
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--bd)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>🗺️ Branch Location Select Karo</div>
                <div style={{ fontSize:11, color:'var(--t2)', marginTop:2 }}>Map pe click karo, pin drag karo ya address search karo</div>
              </div>
              <button onClick={() => { setShowBranchMap(false); branchMapInstRef.current = null }} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--t2)' }}>✕</button>
            </div>

            {/* Search + GPS */}
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bd)', display:'flex', gap:8 }}>
              <input
                ref={branchSearchRef}
                placeholder="🔍 Branch ka address search karo..."
                style={{ flex:1, padding:'9px 12px', border:'1.5px solid var(--bd2)', borderRadius:10, fontSize:13, outline:'none', background:'var(--bg)', color:'var(--t1)' }}
              />
              <button
                onClick={() => {
                  if (!navigator.geolocation) return
                  navigator.geolocation.getCurrentPosition(pos => {
                    const { latitude: la, longitude: ln } = pos.coords
                    const map = branchMapInstRef.current
                    const marker = branchMarkerRef.current
                    if (map && marker) {
                      const p = new window.google.maps.LatLng(la, ln)
                      map.setCenter(p); map.setZoom(17)
                      marker.setPosition(p); marker.setVisible(true)
                    }
                    setNewBranch(p => ({ ...p, lat: la.toFixed(8), lng: ln.toFixed(8) }))
                    reverseGeocodeAdmin(la, ln).then(addr => { if (addr) setNewBranch(p => ({ ...p, address: addr })) })
                  }, () => showToast('GPS error'), { enableHighAccuracy:true, timeout:10000 })
                }}
                style={{ padding:'8px 14px', background:'var(--bl-l)', color:'var(--bl)', border:'1.5px solid var(--bl)', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                📍 GPS
              </button>
            </div>

            {/* Map */}
            <div
              ref={branchMapRef}
              style={{ flex:1, minHeight:320 }}
              // Initialize map when this div mounts
              ref={(el) => {
                branchMapRef.current = el
                if (!el || branchMapInstRef.current) return
                loadGoogleMaps().then(gmaps => {
                  if (!branchMapRef.current) return
                  const initLat = parseFloat(newBranch.lat) || 25.5943
                  const initLng = parseFloat(newBranch.lng) || 85.1376
                  const map = new gmaps.Map(branchMapRef.current, {
                    center: { lat: initLat, lng: initLng },
                    zoom: newBranch.lat ? 16 : 13,
                    mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
                    zoomControlOptions: { position: gmaps.ControlPosition.RIGHT_CENTER }
                  })
                  branchMapInstRef.current = map

                  const marker = new gmaps.Marker({
                    position: { lat: initLat, lng: initLng },
                    map, draggable: true, title: 'Branch location',
                    animation: gmaps.Animation.DROP,
                    visible: !!newBranch.lat
                  })
                  branchMarkerRef.current = marker

                  // Delivery radius circle — updates when pin moves
                  const radiusKm = parseFloat(newBranch.max_delivery_km) || 0
                  let deliveryCircle = radiusKm > 0 ? new gmaps.Circle({
                    map, center: { lat: initLat, lng: initLng },
                    radius: radiusKm * 1000,
                    strokeColor: '#e85d04', strokeOpacity: 0.5, strokeWeight: 2,
                    fillColor: '#e85d04', fillOpacity: 0.08,
                    visible: !!newBranch.lat
                  }) : null

                  const onPick = (lat, lng) => {
                    marker.setVisible(true)
                    if (deliveryCircle) { deliveryCircle.setCenter({ lat, lng }); deliveryCircle.setVisible(true) }
                    setNewBranch(p => ({ ...p, lat: lat.toFixed(8), lng: lng.toFixed(8) }))
                    reverseGeocodeAdmin(lat, lng).then(addr => { if (addr) setNewBranch(p => ({ ...p, address: addr })) })
                  }

                  marker.addListener('dragend', () => {
                    const pos = marker.getPosition()
                    onPick(pos.lat(), pos.lng())
                  })
                  map.addListener('click', e => {
                    marker.setPosition(e.latLng)
                    onPick(e.latLng.lat(), e.latLng.lng())
                  })

                  // Search autocomplete
                  if (branchSearchRef.current) {
                    const ac = new gmaps.places.Autocomplete(branchSearchRef.current, {
                      componentRestrictions: { country: 'in' },
                      fields: ['formatted_address', 'geometry']
                    })
                    ac.addListener('place_changed', () => {
                      const place = ac.getPlace()
                      if (!place.geometry) return
                      const loc = place.geometry.location
                      map.setCenter(loc); map.setZoom(17)
                      marker.setPosition(loc); marker.setVisible(true)
                      setNewBranch(p => ({
                        ...p,
                        lat: loc.lat().toFixed(8),
                        lng: loc.lng().toFixed(8),
                        address: place.formatted_address || p.address
                      }))
                    })
                  }
                })
              }}
            />

            {/* Footer */}
            <div style={{ padding:'12px 14px', borderTop:'1px solid var(--bd)', background:'var(--card)' }}>
              {newBranch.lat && newBranch.lng ? (
                <div style={{ fontSize:12, color:'var(--gr)', marginBottom:10 }}>
                  ✅ {parseFloat(newBranch.lat).toFixed(6)}, {parseFloat(newBranch.lng).toFixed(6)}
                  {newBranch.address && <span style={{ color:'var(--t2)', marginLeft:6 }}>· {newBranch.address.slice(0, 50)}</span>}
                </div>
              ) : (
                <div style={{ fontSize:12, color:'var(--t3)', marginBottom:10 }}>📍 Map pe click karo ya address search karo</div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowBranchMap(false)}
                  style={{ flex:1, padding:'10px', background:'var(--bg)', border:'1px solid var(--bd2)', borderRadius:10, fontSize:13, cursor:'pointer' }}>
                  Cancel
                </button>
                <button
                  disabled={!newBranch.lat || !newBranch.lng}
                  onClick={() => { setShowBranchMap(false); branchMapInstRef.current = null; showToast('📍 Location set ho gaya!') }}
                  style={{ flex:2, padding:'10px', background: (!newBranch.lat || !newBranch.lng) ? '#d1d5db' : 'var(--or)', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor: (!newBranch.lat || !newBranch.lng) ? 'not-allowed' : 'pointer' }}>
                  ✅ Ye Location Use Karo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
