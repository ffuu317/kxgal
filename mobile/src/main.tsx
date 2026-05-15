import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type User = {
  id: string;
  phone: string;
  nickname: string;
  avatarUrl: string;
  bio: string;
  status: string;
  level: string;
  creditCoin: number;
  isMerchant: boolean;
  merchantStatus: string;
  idCardVerified: boolean;
  warningCount: number;
  createdAt: string;
  updatedAt: string;
};

type Post = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  coverImageUrl: string;
  imageUrls: string[];
  merchantId?: string | null;
  merchantName: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  status: string;
  aiVerified: string;
  postType?: "recommend" | "avoid";
  isBountyRecord?: boolean;
  createdAt: string;
  updatedAt: string;
  author: User | null;
  likedByMe: boolean;
};

type Comment = {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  status: string;
  aiVerified: string;
  credibilityScore?: number;
  credibilityLabel?: string;
  credibilityReason?: string;
  credibilityModel?: string;
  consumedCoins: number;
  receiptImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author?: User | null;
  post?: Post | null;
};

type Transaction = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  reason: string;
  relatedId: string | null;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
};

type Bounty = {
  id: string;
  publisherId: string;
  acceptorId: string | null;
  merchantId: string | null;
  merchantName: string;
  merchantAddress: string;
  description: string;
  imageUrls: string[];
  rewardCoins: number;
  status: string;
  aiVerified: string;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  publisher?: User;
  acceptor?: User | null;
  submitDescription?: string;
  submitImageUrls?: string[];
};

type View = "home" | "detail" | "publish" | "mine" | "login" | "register" | "fingerprint-register" | "bounty" | "bounty-publish" | "bounty-detail" | "credit" | "merchant" | "merchant-apply" | "map" | "ranking" | "merchant-detail" | "merchant-photos" | "merchant-comments" | "merchant-bounties" | "merchant-coupons" | "starpoints" | "starpoints-detail";

type Merchant = {
  id: string;
  userId: string;
  businessName: string;
  businessAddress: string;
  businessLicense?: string | null;
  licenseImageUrl?: string | null;
  status: string;
  latitude?: number;
  longitude?: number;
  mapIcon?: string;
  aiVerified?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
};

type WeeklyRanking = {
  id: string;
  rank: number;
  rankType: "hot" | "avoid"; // 热度榜 或 避雷榜
  score: number; // 综合得分（热度榜）或 避雷指数（避雷榜）
  merchant?: Merchant;
  user?: User;
  // 热度榜指标
  hotMetrics?: {
    credibilityScore: number; // 可信度评分 (0-100)
    positiveRate: number; // 好评率 (0-100%)
    clickRate: number; // 点击率 (周访问量)
    postCount: number; // 食证帖数
    aiScore: number; // AI综合评分
  };
  // 避雷榜指标
  avoidMetrics?: {
    avoidLevel: "warning" | "danger" | "severe"; // 避雷等级
    reasons: string[]; // 避雷原因
    negativeCount: number; // 差评数
    reportCount: number; // 举报数
    lastIncident?: string; // 最近问题
  };
};

// 地图商家类型（关联平台内部数据）
type MapMerchant = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: string;
  tel?: string;
  distance?: number;
  // 平台内部可信度数据
  credibilityScore: number; // 可信度评分 0-100
  credibilityLevel: "high" | "medium" | "low"; // 可信度等级
  postCount: number; // 食证帖子数
  verifiedPostCount: number; // 已验真帖子数
  latestPost?: Post; // 最新食证评价
  photos: { id: string; url: string; aiVerified: string; uploadedBy: string }[]; // 平台上传的照片
  hasStarPoints?: boolean; // 是否开通星享积分（开通后获得更多推流）
};

type MerchantPhoto = {
  id: string;
  merchantId: string;
  photoType: string;
  url: string;
  aiVerified: string;
  uploadedAt: string;
};

type MerchantComment = {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  status: string;
  aiVerified: string;
  consumedCoins: number;
  receiptImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author?: User | null;
  postTitle?: string;
};

// 商家星享积分类型
type StarPoints = {
  merchantId: string;
  merchantName: string;
  points: number; // 当前积分余额
  totalEarned: number; // 累计获得
  level: "bronze" | "silver" | "gold" | "platinum"; // 会员等级
  nextLevelPoints: number; // 下一等级所需积分
};

// 优惠券/权益类型
type MerchantReward = {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  type: "coupon" | "discount" | "package" | "gift";
  pointsCost: number; // 兑换所需积分
  originalPrice?: number; // 原价
  discountValue?: number; // 折扣值
  validityDays: number; // 有效期天数
  stock: number; // 库存
  claimedCount: number; // 已兑换数量
  imageUrl?: string;
  terms?: string; // 使用条款
};

// 商家优惠券类型
type Coupon = {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  type: "coupon" | "discount" | "package" | "gift";
  pointsCost: number;
  originalPrice?: number;
  discountValue?: number;
  validityDays: number;
  stock: number;
  imageUrl?: string;
  terms?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

// 用户已兑换的权益
type UserReward = {
  id: string;
  rewardId: string;
  merchantId: string;
  merchantName: string;
  title: string;
  description: string;
  type: "coupon" | "discount" | "package" | "gift";
  pointsCost: number;
  claimedAt: string;
  expiresAt: string;
  usedAt?: string;
  status: "active" | "used" | "expired";
  code: string; // 兑换码
};

const apiBase = "/api";

// 商家类型图标映射（全局可用）
function getIconByType(type: string): string {
  const iconMap: Record<string, string> = {
    "快餐": "🍔",
    "咖啡厅": "☕",
    "火锅": "🔥",
    "西餐": "🍕",
    "饮品": "🧋",
    "中式快餐": "🍚",
    "甜品": "🍰",
    "面食": "🍜",
    "日式快餐": "🍱",
    "麻辣烫": "🥘"
  };
  return iconMap[type] || "🏪";
}

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...((options.headers || {}) as Record<string, string>)
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${apiBase}${path}`, { cache: "no-store", ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "请求失败");
  return data as T;
}

function formValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function aiLabel(status?: string) {
  if (status === "verified") return "AI已验真";
  if (status === "fake") return "疑似异常";
  return "待检测";
}

function credibilityLabel(label?: string) {
  if (label === "high") return "高";
  if (label === "medium") return "中";
  if (label === "low") return "低";
  return "高";
}

function bountyStatusLabel(status: string) {
  if (status === "active") return "待接取";
  if (status === "accepted") return "进行中";
  if (status === "completed") return "已完成";
  if (status === "failed") return "未通过";
  return "已关闭";
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("eattruth.token") || "");
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([
    {
      id: "post_demo_1",
      authorId: "user_demo_1",
      title: "这家火锅店需要避雷",
      content: "价格贵，分量少，服务态度差。不推荐去。",
      coverImageUrl: "/img/hotpot-bad.svg",
      imageUrls: ["/img/hotpot-bad.svg"],
      merchantName: "京城火锅店",
      tags: ["避雷", "火锅", "价格贵"],
      likeCount: 12,
      commentCount: 3,
      status: "active",
      aiVerified: "verified",
      postType: "avoid",
      merchantId: "m_demo2",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      author: { id: "user_demo_1", phone: "139****1111", nickname: "美食探长", avatarUrl: "", bio: "资深吃货", status: "active", level: "gold", creditCoin: 500, isMerchant: false, merchantStatus: "none", idCardVerified: true, warningCount: 0, createdAt: "", updatedAt: "" },
      likedByMe: false
    },
    {
      id: "post_demo_2",
      authorId: "user_demo_2",
      title: "街角面馆的牛肉面",
      content: "汤底清亮，牛肉分量比菜单图更扎实。午饭高峰要排队，整体值得再来。",
      coverImageUrl: "/img/beef-noodle.svg",
      imageUrls: ["/img/beef-noodle.svg"],
      merchantName: "老巷牛肉面",
      tags: ["推荐", "面馆", "牛肉面"],
      likeCount: 28,
      commentCount: 7,
      status: "active",
      aiVerified: "verified",
      postType: "recommend",
      merchantId: "m_demo",
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      author: { id: "user_demo_2", phone: "138****2222", nickname: "面食爱好者", avatarUrl: "", bio: "", status: "active", level: "silver", creditCoin: 200, isMerchant: false, merchantStatus: "none", idCardVerified: false, warningCount: 0, createdAt: "", updatedAt: "" },
      likedByMe: false
    },
    {
      id: "post_demo_3",
      authorId: "user_demo_3",
      title: "大学城旁边的炸鸡店",
      content: "炸鸡外酥里嫩，配上他们家的甜辣酱绝了。人均20左右，学生党福音。",
      coverImageUrl: "/img/fried-chicken.svg",
      imageUrls: ["/img/fried-chicken.svg"],
      merchantName: "脆皮炸鸡",
      tags: ["推荐", "炸鸡", "学生党"],
      likeCount: 45,
      commentCount: 12,
      status: "active",
      aiVerified: "verified",
      postType: "recommend",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      author: { id: "user_demo_3", phone: "137****3333", nickname: "吃遍大学城", avatarUrl: "", bio: "大学生美食博主", status: "active", level: "bronze", creditCoin: 80, isMerchant: false, merchantStatus: "none", idCardVerified: false, warningCount: 0, createdAt: "", updatedAt: "" },
      likedByMe: false
    }
  ]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [myComments, setMyComments] = useState<Comment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bounties, setBounties] = useState<Bounty[]>([
    {
      id: "bounty_demo_1",
      publisherId: "user_system",
      acceptorId: null,
      merchantId: null,
      merchantName: "老巷牛肉面",
      merchantAddress: "杭州市钱塘区文泽路99号弗雷德广场B1层",
      description: "帮忙去这家店拍一下门头照片，确认是否还在营业",
      imageUrls: [],
      rewardCoins: 30,
      status: "active",
      aiVerified: "pending",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "bounty_demo_2",
      publisherId: "user_system",
      acceptorId: null,
      merchantId: null,
      merchantName: "京城火锅店",
      merchantAddress: "杭州市西湖区文三路50号",
      description: "需要帮忙确认这家店的营业时间和人均消费",
      imageUrls: [],
      rewardCoins: 50,
      status: "active",
      aiVerified: "pending",
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [view, setView] = useState<View>("home");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Post[] | null>(null);
  const [searchMerchants, setSearchMerchants] = useState<Merchant[] | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [receiptDataUrl, setReceiptDataUrl] = useState("");
  const [message, setMessage] = useState("");
  const [postFilter, setPostFilter] = useState<"all" | "recommend" | "avoid">("all");
  const [merchants, setMerchants] = useState<Merchant[]>([
    {
      id: "m_demo",
      userId: "user_merchant_1",
      businessName: "老巷牛肉面",
      businessAddress: "杭州市钱塘区文泽路99号弗雷德广场B1层",
      status: "approved",
      latitude: 30.3192,
      longitude: 120.3585,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "m_demo2",
      userId: "user_merchant_2",
      businessName: "京城火锅店",
      businessAddress: "杭州市西湖区文三路50号",
      status: "approved",
      latitude: 30.2792,
      longitude: 120.1285,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "m_ffuu",
      userId: "user_ffuu",
      businessName: "ffuu",
      businessAddress: "测试地址",
      status: "approved",
      latitude: 30.3000,
      longitude: 120.3000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [merchantPosts, setMerchantPosts] = useState<Post[]>([]);
  const [merchantBounties, setMerchantBounties] = useState<Bounty[]>([]);
  const [merchantPhotos, setMerchantPhotos] = useState<any[]>([]);
  const [merchantComments, setMerchantComments] = useState<MerchantComment[]>([]);
  const [merchantBountiesList, setMerchantBountiesList] = useState<Bounty[]>([]);
  const [merchantCoupons, setMerchantCoupons] = useState<Coupon[]>([]);
  const [rankings, setRankings] = useState<WeeklyRanking[]>([]);
  const [rankingTab, setRankingTab] = useState<"hot" | "avoid">("hot");
  
  // 指纹注册相关状态
  const [pendingRegisterData, setPendingRegisterData] = useState<{phone: string; password: string; nickname: string} | null>(null);
  
  // 真实地图相关状态
  const [mapMerchants, setMapMerchants] = useState<MapMerchant[]>([]);
  const [selectedMapMerchant, setSelectedMapMerchant] = useState<MapMerchant | null>(null);
  const [mapPopupOpen, setMapPopupOpen] = useState(false);
  
  // 商家星享积分相关状态
  const [merchantStarPoints, setMerchantStarPoints] = useState<Record<string, StarPoints>>({});
  const [merchantRewards, setMerchantRewards] = useState<Record<string, MerchantReward[]>>({});
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [selectedRewardMerchant, setSelectedRewardMerchant] = useState<MapMerchant | null>(null);

  const myPosts = useMemo(() => posts.filter((post) => post.authorId === user?.id), [posts, user]);
  const myBounties = useMemo(() => bounties.filter((b) => b.publisherId === user?.id || b.acceptorId === user?.id), [bounties, user]);

  async function api<T>(path: string, options: RequestInit = {}) {
    return request<T>(path, token, options);
  }

  function flash(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage((current) => (current === nextMessage ? "" : current)), 2200);
  }

  async function loadPosts(nextQuery = query, nextPostFilter = postFilter) {
    // mock模式：根据搜索关键词和筛选条件过滤帖子
    let filteredPosts = [...posts];
    
    // 根据帖子类型筛选
    if (nextPostFilter !== "all") {
      filteredPosts = filteredPosts.filter(post => post.postType === nextPostFilter);
    }
    
    // 根据搜索关键词筛选并排序（匹配度高的置顶）
    if (nextQuery) {
      const queryLower = nextQuery.toLowerCase();
      filteredPosts = filteredPosts.map(post => {
        const titleMatch = post.title?.toLowerCase().includes(queryLower) ? 1 : 0;
        const contentMatch = post.content?.toLowerCase().includes(queryLower) ? 1 : 0;
        const tagMatch = post.tags?.some(tag => tag.toLowerCase().includes(queryLower)) ? 1 : 0;
        const merchantMatch = post.merchantName?.toLowerCase().includes(queryLower) ? 1 : 0;
        return {
          ...post,
          matchScore: titleMatch * 3 + contentMatch * 2 + tagMatch * 2 + merchantMatch * 1
        };
      }).filter(post => post.matchScore > 0)
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      
      // 同时搜索商家
      const matchedMerchants = merchants.filter(m => 
        m.businessName.toLowerCase().includes(queryLower) ||
        m.businessAddress.toLowerCase().includes(queryLower)
      ).sort((a, b) => {
        // 完全匹配优先
        const aExact = a.businessName.toLowerCase() === queryLower ? 2 : a.businessName.toLowerCase().startsWith(queryLower) ? 1 : 0;
        const bExact = b.businessName.toLowerCase() === queryLower ? 2 : b.businessName.toLowerCase().startsWith(queryLower) ? 1 : 0;
        return bExact - aExact;
      });
      setSearchMerchants(matchedMerchants);
    } else {
      setSearchMerchants(null);
    }
    
    // 更新状态
    setQuery(nextQuery);
    setPostFilter(nextPostFilter);
    setSearchResults(nextQuery ? filteredPosts : null);
  }

  async function loadMerchants() {
    // mock模式：使用本地数据
  }

  async function loadMerchantDetail(merchantId: string) {
    // mock模式：从本地merchants查找
    const found = merchants.find(m => m.id === merchantId);
    if (found) {
      setSelectedMerchant(found);
      // 根据商家ID、商家名称以及标题/正文包含@商家名来匹配帖子
      const matchedPosts = posts.filter(post => {
        // 直接匹配merchantId
        if (post.merchantId === merchantId) return true;
        // 匹配商家名称
        if (found.businessName && post.merchantName) {
          if (post.merchantName.includes(found.businessName) || found.businessName.includes(post.merchantName)) {
            return true;
          }
        }
        // 检查标题和正文是否包含@商家名
        const fullText = `${post.title || ""} ${post.content || ""}`;
        if (found.businessName && fullText.includes(`@${found.businessName}`)) {
          return true;
        }
        return false;
      });
      // 根据商家ID、商家名称匹配悬赏
      const matchedBounties = bounties.filter(bounty => {
        if (bounty.merchantId === merchantId) return true;
        if (found.businessName && bounty.merchantName) {
          if (bounty.merchantName.includes(found.businessName) || found.businessName.includes(bounty.merchantName)) {
            return true;
          }
        }
        // 检查商家名称和描述
        const fullText = `${bounty.merchantName || ""} ${bounty.description || ""}`;
        if (found.businessName && fullText.includes(`@${found.businessName}`)) {
          return true;
        }
        return false;
      });
      setMerchantPosts(matchedPosts);
      setMerchantBounties(matchedBounties);
      setMerchantPhotos([]);
    }
  }

  async function loadMyComments() {
    try {
      const data = await api<{ comments: Comment[] }>("/users/me/comments");
      setMyComments(data.comments);
    } catch (error) {
      console.error("Failed to load my comments:", error);
    }
  }

  async function loadMerchantCenter() {
    try {
      const data = await api<{ merchant: Merchant | null; posts: Post[]; bounties: Bounty[] }>("/users/me/merchant");
      setMerchant(data.merchant);
      setMerchantPosts(data.posts);
      setMerchantBounties(data.bounties);
    } catch (error) {
      console.error("Failed to load merchant center:", error);
    }
  }

  async function loadTransactions() {
    try {
      const data = await api<{ transactions: Transaction[] }>("/users/me/transactions");
      setTransactions(data.transactions);
    } catch {
      setTransactions([]);
    }
  }

  async function refreshMe() {
    try {
      const data = await api<{ user: User }>("/users/me");
      setUser(data.user);
    } catch {
      // Mock sessions can keep their local user shape.
    }
  }

  // 生成热度榜数据（AI计算：可信度40% + 好评率35% + 点击率25%）
  function generateHotRankings(): WeeklyRanking[] {
    const hotMerchants = [
      { id: "hot_1", name: "海底捞火锅(下沙弗雷德店)", type: "火锅", credibility: 95, positiveRate: 92, clicks: 3580, posts: 128 },
      { id: "hot_2", name: "星巴克(弗雷德广场店)", type: "咖啡厅", credibility: 88, positiveRate: 89, clicks: 2890, posts: 86 },
      { id: "hot_3", name: "麦当劳(弗雷德广场店)", type: "快餐", credibility: 90, positiveRate: 85, clicks: 4120, posts: 95 },
      { id: "hot_4", name: "一点点(弗雷德广场店)", type: "饮品", credibility: 82, positiveRate: 88, clicks: 2340, posts: 67 },
      { id: "hot_5", name: "鲜芋仙(弗雷德广场店)", type: "甜品", credibility: 85, positiveRate: 91, clicks: 1890, posts: 54 },
      { id: "hot_6", name: "CoCo都可(弗雷德广场店)", type: "饮品", credibility: 80, positiveRate: 84, clicks: 2150, posts: 48 },
      { id: "hot_7", name: "必胜客(弗雷德广场店)", type: "西餐", credibility: 78, positiveRate: 79, clicks: 1680, posts: 42 },
      { id: "hot_8", name: "真功夫(弗雷德广场店)", type: "中式快餐", credibility: 75, positiveRate: 82, clicks: 1420, posts: 38 },
    ];

    // AI综合评分计算：可信度40% + 好评率35% + 点击率25%（点击率归一化到0-100）
    const maxClicks = Math.max(...hotMerchants.map(m => m.clicks));
    
    return hotMerchants.map((m, index) => {
      const normalizedClicks = (m.clicks / maxClicks) * 100;
      const aiScore = Math.round(m.credibility * 0.4 + m.positiveRate * 0.35 + normalizedClicks * 0.25);
      
      return {
        id: m.id,
        rank: index + 1,
        rankType: "hot" as const,
        score: aiScore,
        merchant: {
          id: m.id,
          userId: "system",
          businessName: m.name,
          businessAddress: "杭州市钱塘区文泽路99号弗雷德广场",
          latitude: 30.3186,
          longitude: 120.3425,
          mapIcon: getIconByType(m.type),
          status: "approved",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        hotMetrics: {
          credibilityScore: m.credibility,
          positiveRate: m.positiveRate,
          clickRate: m.clicks,
          postCount: m.posts,
          aiScore: aiScore
        }
      };
    }).sort((a, b) => b.score - a.score).map((item, index) => ({ ...item, rank: index + 1 }));
  }

  // 生成避雷榜数据
  function generateAvoidRankings(): WeeklyRanking[] {
    const avoidMerchants = [
      { 
        id: "avoid_1", 
        name: "某网红奶茶店", 
        type: "饮品",
        level: "severe" as const,
        reasons: ["虚假宣传", "价格欺诈", "卫生问题"],
        negativeCount: 156,
        reportCount: 48,
        incident: "多名用户反映饮品与宣传严重不符"
      },
      { 
        id: "avoid_2", 
        name: "某烧烤店", 
        type: "中式快餐",
        level: "danger" as const,
        reasons: ["食材不新鲜", "服务态度差", "价格虚高"],
        negativeCount: 89,
        reportCount: 23,
        incident: "用户反馈食材变质导致肠胃不适"
      },
      { 
        id: "avoid_3", 
        name: "某快餐连锁", 
        type: "快餐",
        level: "danger" as const,
        reasons: ["分量严重缩水", "虚假优惠"],
        negativeCount: 67,
        reportCount: 15,
        incident: "优惠活动与实际不符"
      },
      { 
        id: "avoid_4", 
        name: "某甜品店", 
        type: "甜品",
        level: "warning" as const,
        reasons: ["服务态度差", "环境脏乱"],
        negativeCount: 45,
        reportCount: 12,
        incident: "店内卫生状况堪忧"
      },
      { 
        id: "avoid_5", 
        name: "某面馆", 
        type: "面食",
        level: "warning" as const,
        reasons: ["价格不透明", "隐形消费"],
        negativeCount: 38,
        reportCount: 8,
        incident: "结账时发现额外收费项目"
      },
    ];

    // 避雷指数 = 差评数*0.5 + 举报数*1.5 + 等级加权
    const levelWeight = { severe: 50, danger: 30, warning: 15 };
    
    return avoidMerchants.map((m, index) => {
      const avoidScore = Math.round(m.negativeCount * 0.5 + m.reportCount * 1.5 + levelWeight[m.level]);
      
      return {
        id: m.id,
        rank: index + 1,
        rankType: "avoid" as const,
        score: avoidScore,
        merchant: {
          id: m.id,
          userId: "system",
          businessName: m.name,
          businessAddress: "杭州市钱塘区",
          latitude: 30.3186,
          longitude: 120.3425,
          mapIcon: getIconByType(m.type),
          status: "approved",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        avoidMetrics: {
          avoidLevel: m.level,
          reasons: m.reasons,
          negativeCount: m.negativeCount,
          reportCount: m.reportCount,
          lastIncident: m.incident
        }
      };
    }).sort((a, b) => b.score - a.score).map((item, index) => ({ ...item, rank: index + 1 }));
  }

  // 加载榜单数据
  function loadRankings(tab: "hot" | "avoid") {
    if (tab === "hot") {
      setRankings(generateHotRankings());
    } else {
      setRankings(generateAvoidRankings());
    }
  }

  // 商家自传图管理 - 加载图片列表
  async function loadMerchantPhotos() {
    try {
      const data = await api<{ photos: MerchantPhoto[] }>("/merchant/me/photos");
      setMerchantPhotos(data.photos);
    } catch (error) {
      console.error("Failed to load merchant photos:", error);
    }
  }

  // 商家自传图管理 - 上传图片
  async function uploadMerchantPhoto(photoDataUrl: string, photoType: string) {
    try {
      // mock模式：直接添加到本地列表
      setMerchantPhotos(prev => [...prev, { id: "photo_" + Date.now(), url: photoDataUrl, type: photoType }]);
      flash("图片上传成功");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  // 商家自传图管理 - 删除图片
  async function deleteMerchantPhoto(photoId: string) {
    try {
      // mock模式：直接从本地列表删除
      setMerchantPhotos(prev => prev.filter(p => p.id !== photoId));
      flash("图片已删除");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  // 消费者评论管理 - 加载评论列表
  async function loadMerchantComments() {
    // mock模式：使用本地数据
  }

  // 消费者评论管理 - 回复评论
  async function replyComment(commentId: string, content: string) {
    try {
      // mock模式：直接更新本地评论
      setMerchantComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, reply: content, repliedAt: new Date().toISOString() } : c
      ));
      flash("回复已发送");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  // 被悬赏记录 - 加载悬赏列表
  async function loadMerchantBounties() {
    try {
      const data = await api<{ bounties: Bounty[] }>("/merchant/me/bounties");
      setMerchantBountiesList(data.bounties);
    } catch (error) {
      console.error("Failed to load merchant bounties:", error);
    }
  }

  async function loadBounties() {
    // mock模式：使用本地数据，不请求API
    // bounties 已通过 publishBounty 等操作更新
  }

  async function loadMyBounties() {
    // mock模式：使用本地数据，不请求API
    // bounties 已通过 publishBounty 等操作更新
  }

  // 获取弗雷德广场周边真实商家数据
  async function loadMapMerchants() {
    // 直接使用本地模拟数据（地图商家数据来自平台自有数据，不依赖第三方API）
    const mockMerchants = getMockFredaMerchants().map(m => ({
      ...m,
      hasStarPoints: STAR_POINTS_MERCHANT_IDS.has(m.id)
    }));
    // 推流排序：开通星享积分的商家优先展示，同组内按可信度排序
    mockMerchants.sort((a, b) => {
      if (a.hasStarPoints !== b.hasStarPoints) return a.hasStarPoints ? -1 : 1;
      return b.credibilityScore - a.credibilityScore;
    });
    setMapMerchants(mockMerchants);
    // 加载每个商家的星享积分数据
    mockMerchants.forEach(merchant => {
      loadMerchantStarPoints(merchant.id);
      loadMerchantRewards(merchant.id);
    });
  }

  // 加载商家星享积分
  async function loadMerchantStarPoints(merchantId: string) {
    try {
      const data = await api<{ starPoints: StarPoints }>(`/merchants/${merchantId}/starpoints`);
      setMerchantStarPoints(prev => ({ ...prev, [merchantId]: data.starPoints }));
    } catch {
      // 使用模拟数据
      const mockPoints: StarPoints = {
        merchantId,
        merchantName: getMerchantNameById(merchantId),
        points: Math.floor(Math.random() * 500) + 100,
        totalEarned: Math.floor(Math.random() * 1000) + 200,
        level: ["bronze", "silver", "gold", "platinum"][Math.floor(Math.random() * 4)] as any,
        nextLevelPoints: 500
      };
      setMerchantStarPoints(prev => ({ ...prev, [merchantId]: mockPoints }));
    }
  }

  // 加载商家权益列表
  async function loadMerchantRewards(merchantId: string) {
    try {
      const data = await api<{ rewards: MerchantReward[] }>(`/merchants/${merchantId}/rewards`);
      setMerchantRewards(prev => ({ ...prev, [merchantId]: data.rewards }));
    } catch {
      // 使用模拟数据
      const mockRewards = generateMockRewards(merchantId);
      setMerchantRewards(prev => ({ ...prev, [merchantId]: mockRewards }));
    }
  }

  // 生成模拟权益数据
  function generateMockRewards(merchantId: string): MerchantReward[] {
    const rewardTypes = [
      { type: "coupon" as const, title: "满100减20优惠券", desc: "消费满100元可用", cost: 50 },
      { type: "discount" as const, title: "8.8折折扣券", desc: "全场通用折扣", cost: 100 },
      { type: "package" as const, title: "双人套餐兑换", desc: "价值128元双人套餐", cost: 200 },
      { type: "gift" as const, title: "招牌饮品1杯", desc: "任选招牌饮品", cost: 80 },
      { type: "coupon" as const, title: "免单券", desc: "单次消费免单（限50元内）", cost: 300 },
    ];
    
    return rewardTypes.map((r, idx) => ({
      id: `reward_${merchantId}_${idx}`,
      merchantId,
      title: r.title,
      description: r.desc,
      type: r.type,
      pointsCost: r.cost,
      originalPrice: r.type === "package" ? 128 : r.type === "gift" ? 28 : undefined,
      discountValue: r.type === "discount" ? 0.88 : undefined,
      validityDays: 30,
      stock: Math.floor(Math.random() * 50) + 10,
      claimedCount: Math.floor(Math.random() * 100),
      imageUrl: [
        "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#ff6b6b"/><text x="100" y="80" text-anchor="middle" font-size="14" fill="white">优惠券</text></svg>'),
        "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#4ecdc4"/><text x="100" y="80" text-anchor="middle" font-size="14" fill="white">折扣券</text></svg>'),
        "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#ffeaa7"/><text x="100" y="80" text-anchor="middle" font-size="14" fill="#2d3436">套餐券</text></svg>'),
        "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#a29bfe"/><text x="100" y="80" text-anchor="middle" font-size="14" fill="white">赠品券</text></svg>'),
        "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#fd79a8"/><text x="100" y="80" text-anchor="middle" font-size="14" fill="white">免单券</text></svg>')
      ][idx] || "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#636e72"/><text x="100" y="80" text-anchor="middle" font-size="14" fill="white">兑换券</text></svg>'),
      terms: "不可与其他优惠叠加使用，最终解释权归商家所有"
    }));
  }

  function getMerchantNameById(id: string): string {
    const merchant = mapMerchants.find(m => m.id === id);
    return merchant?.name || "商家";
  }

  // 兑换权益
  async function claimReward(reward: MerchantReward) {
    if (!token) {
      setView("login");
      return;
    }
    
    const starPoints = merchantStarPoints[reward.merchantId];
    if (!starPoints || starPoints.points < reward.pointsCost) {
      flash("星享积分不足");
      return;
    }
    
    try {
      const data = await api<{ userReward: UserReward }>(`/rewards/${reward.id}/claim`, {
        method: "POST",
        body: JSON.stringify({ merchantId: reward.merchantId })
      });
      
      // 更新积分余额
      setMerchantStarPoints(prev => ({
        ...prev,
        [reward.merchantId]: {
          ...prev[reward.merchantId]!,
          points: prev[reward.merchantId]!.points - reward.pointsCost
        }
      }));
      
      // 添加到用户权益列表
      setUserRewards(prev => [data.userReward, ...prev]);
      
      flash(`成功兑换「${reward.title}」`);
    } catch (error) {
      flash("兑换失败，请重试");
    }
  }

  // 开通星享积分的商家ID集合（开通后获得更多推流曝光）
  const STAR_POINTS_MERCHANT_IDS = new Set(["map_1", "map_2", "map_4", "map_6", "map_8", "map_11"]);

  // 模拟弗雷德广场周边真实商家数据
  function getMockFredaMerchants(): MapMerchant[] {
    // 弗雷德广场坐标（杭州市钱塘区文泽路99号）
    const centerLat = 30.3186;
    const centerLng = 120.3425;
    
    const merchants: MapMerchant[] = [
      {
        id: "map_1",
        name: "麦当劳(弗雷德广场店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场1层",
        latitude: centerLat + 0.0005,
        longitude: centerLng + 0.0003,
        type: "快餐",
        tel: "0571-8688xxxx",
        distance: 50,
        credibilityScore: 92,
        credibilityLevel: "high",
        postCount: 45,
        verifiedPostCount: 42,
        photos: [
          { id: "p1", url: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200", aiVerified: "verified", uploadedBy: "美食达人" },
          { id: "p2", url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200", aiVerified: "verified", uploadedBy: "小明" }
        ],
        latestPost: {
          id: "post_1",
          authorId: "u1",
          title: "麦当劳新品测评",
          content: "新出的汉堡味道不错，肉饼很厚实",
          coverImageUrl: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400"],
          merchantName: "麦当劳",
          tags: ["快餐", "汉堡"],
          likeCount: 23,
          commentCount: 5,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-10T10:00:00Z",
          updatedAt: "2025-05-10T10:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_2",
        name: "星巴克(弗雷德广场店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场1层",
        latitude: centerLat - 0.0004,
        longitude: centerLng + 0.0005,
        type: "咖啡厅",
        tel: "0571-8699xxxx",
        distance: 80,
        credibilityScore: 88,
        credibilityLevel: "high",
        postCount: 32,
        verifiedPostCount: 30,
        photos: [
          { id: "p3", url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200", aiVerified: "verified", uploadedBy: "咖啡控" }
        ],
        latestPost: {
          id: "post_2",
          authorId: "u2",
          title: "星巴克环境测评",
          content: "环境很好，适合学习和办公",
          coverImageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400"],
          merchantName: "星巴克",
          tags: ["咖啡", "环境"],
          likeCount: 18,
          commentCount: 3,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-09T14:00:00Z",
          updatedAt: "2025-05-09T14:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_3",
        name: "肯德基(下沙弗雷德店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场2层",
        latitude: centerLat + 0.0003,
        longitude: centerLng - 0.0004,
        type: "快餐",
        tel: "0571-8677xxxx",
        distance: 60,
        credibilityScore: 85,
        credibilityLevel: "high",
        postCount: 28,
        verifiedPostCount: 25,
        photos: [],
        latestPost: {
          id: "post_3",
          authorId: "u3",
          title: "肯德基炸鸡测评",
          content: "炸鸡酥脆，但是人有点多",
          coverImageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400"],
          merchantName: "肯德基",
          tags: ["快餐", "炸鸡"],
          likeCount: 15,
          commentCount: 4,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-08T12:00:00Z",
          updatedAt: "2025-05-08T12:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_4",
        name: "海底捞火锅(下沙弗雷德店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场3层",
        latitude: centerLat - 0.0006,
        longitude: centerLng - 0.0002,
        type: "火锅",
        tel: "0571-8666xxxx",
        distance: 120,
        credibilityScore: 95,
        credibilityLevel: "high",
        postCount: 67,
        verifiedPostCount: 65,
        photos: [
          { id: "p4", url: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=200", aiVerified: "verified", uploadedBy: "火锅控" },
          { id: "p5", url: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=200", aiVerified: "verified", uploadedBy: "聚餐达人" }
        ],
        latestPost: {
          id: "post_4",
          authorId: "u4",
          title: "海底捞服务体验",
          content: "服务超好，食材新鲜，适合聚会",
          coverImageUrl: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1555126634-323283e090fa?w=400"],
          merchantName: "海底捞",
          tags: ["火锅", "服务"],
          likeCount: 45,
          commentCount: 12,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-07T18:00:00Z",
          updatedAt: "2025-05-07T18:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_5",
        name: "必胜客(弗雷德广场餐厅)",
        address: "杭州市钱塘区文泽路99号弗雷德广场1层",
        latitude: centerLat + 0.0007,
        longitude: centerLng + 0.0001,
        type: "西餐",
        tel: "0571-8655xxxx",
        distance: 90,
        credibilityScore: 82,
        credibilityLevel: "high",
        postCount: 22,
        verifiedPostCount: 20,
        photos: [],
        latestPost: {
          id: "post_5",
          authorId: "u5",
          title: "必胜客披萨测评",
          content: "披萨好吃，适合带孩子",
          coverImageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400"],
          merchantName: "必胜客",
          tags: ["西餐", "披萨"],
          likeCount: 12,
          commentCount: 2,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-06T19:00:00Z",
          updatedAt: "2025-05-06T19:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_6",
        name: "一点点(弗雷德店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场B1层",
        latitude: centerLat - 0.0002,
        longitude: centerLng + 0.0006,
        type: "饮品",
        tel: "0571-8644xxxx",
        distance: 70,
        credibilityScore: 78,
        credibilityLevel: "medium",
        postCount: 18,
        verifiedPostCount: 15,
        photos: [
          { id: "p6", url: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=200", aiVerified: "verified", uploadedBy: "奶茶控" }
        ],
        latestPost: {
          id: "post_6",
          authorId: "u6",
          title: "一点点珍珠奶茶",
          content: "珍珠Q弹，性价比高",
          coverImageUrl: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1558857563-b371033873b8?w=400"],
          merchantName: "一点点",
          tags: ["饮品", "奶茶"],
          likeCount: 20,
          commentCount: 6,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-05T15:00:00Z",
          updatedAt: "2025-05-05T15:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_7",
        name: "老娘舅(弗雷德广场店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场B1层",
        latitude: centerLat + 0.0002,
        longitude: centerLng - 0.0007,
        type: "中式快餐",
        tel: "0571-8633xxxx",
        distance: 100,
        credibilityScore: 75,
        credibilityLevel: "medium",
        postCount: 15,
        verifiedPostCount: 12,
        photos: [],
        latestPost: {
          id: "post_7",
          authorId: "u7",
          title: "老娘舅快餐体验",
          content: "出餐快，米饭香",
          coverImageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400"],
          merchantName: "老娘舅",
          tags: ["快餐", "中式"],
          likeCount: 8,
          commentCount: 1,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-04T11:00:00Z",
          updatedAt: "2025-05-04T11:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_8",
        name: "鲜芋仙(弗雷德广场店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场2层",
        latitude: centerLat - 0.0005,
        longitude: centerLng - 0.0005,
        type: "甜品",
        tel: "0571-8622xxxx",
        distance: 110,
        credibilityScore: 80,
        credibilityLevel: "high",
        postCount: 20,
        verifiedPostCount: 18,
        photos: [
          { id: "p7", url: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=200", aiVerified: "verified", uploadedBy: "甜品控" }
        ],
        latestPost: {
          id: "post_8",
          authorId: "u8",
          title: "鲜芋仙芋圆测评",
          content: "芋圆好吃，颜值高",
          coverImageUrl: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400"],
          merchantName: "鲜芋仙",
          tags: ["甜品", "芋圆"],
          likeCount: 25,
          commentCount: 8,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-03T16:00:00Z",
          updatedAt: "2025-05-03T16:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_9",
        name: "重庆小面(弗雷德店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场B1层美食街",
        latitude: centerLat + 0.0008,
        longitude: centerLng - 0.0003,
        type: "面食",
        tel: "0571-8611xxxx",
        distance: 130,
        credibilityScore: 72,
        credibilityLevel: "medium",
        postCount: 12,
        verifiedPostCount: 10,
        photos: [],
        latestPost: {
          id: "post_9",
          authorId: "u9",
          title: "重庆小面试吃",
          content: "麻辣够味，正宗重庆味",
          coverImageUrl: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1552611052-33e04de081de?w=400"],
          merchantName: "重庆小面",
          tags: ["面食", "辣"],
          likeCount: 10,
          commentCount: 3,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-02T12:00:00Z",
          updatedAt: "2025-05-02T12:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_10",
        name: "食其家(弗雷德广场店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场B1层",
        latitude: centerLat - 0.0003,
        longitude: centerLng + 0.0008,
        type: "日式快餐",
        tel: "0571-8600xxxx",
        distance: 85,
        credibilityScore: 77,
        credibilityLevel: "medium",
        postCount: 16,
        verifiedPostCount: 14,
        photos: [],
        latestPost: {
          id: "post_10",
          authorId: "u10",
          title: "食其家牛井饭",
          content: "牛井饭好吃，出餐快",
          coverImageUrl: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1553621042-f6e147245754?w=400"],
          merchantName: "食其家",
          tags: ["日式", "快餐"],
          likeCount: 14,
          commentCount: 4,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-05-01T13:00:00Z",
          updatedAt: "2025-05-01T13:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_11",
        name: "CoCo都可(弗雷德店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场1层",
        latitude: centerLat + 0.0004,
        longitude: centerLng + 0.0007,
        type: "饮品",
        tel: "0571-8599xxxx",
        distance: 75,
        credibilityScore: 79,
        credibilityLevel: "medium",
        postCount: 19,
        verifiedPostCount: 17,
        photos: [
          { id: "p8", url: "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=200", aiVerified: "verified", uploadedBy: "奶茶控" }
        ],
        latestPost: {
          id: "post_11",
          authorId: "u11",
          title: "CoCo三兄弟",
          content: "三兄弟好喝，经常排队",
          coverImageUrl: "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=400"],
          merchantName: "CoCo都可",
          tags: ["饮品", "奶茶"],
          likeCount: 22,
          commentCount: 7,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-04-30T14:00:00Z",
          updatedAt: "2025-04-30T14:00:00Z",
          author: null,
          likedByMe: false
        }
      },
      {
        id: "map_12",
        name: "张亮麻辣烫(弗雷德店)",
        address: "杭州市钱塘区文泽路99号弗雷德广场B1层美食街",
        latitude: centerLat - 0.0007,
        longitude: centerLng + 0.0004,
        type: "麻辣烫",
        tel: "0571-8588xxxx",
        distance: 140,
        credibilityScore: 70,
        credibilityLevel: "medium",
        postCount: 11,
        verifiedPostCount: 9,
        photos: [],
        latestPost: {
          id: "post_12",
          authorId: "u12",
          title: "张亮麻辣烫体验",
          content: "汤底浓郁，食材新鲜",
          coverImageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400",
          imageUrls: ["https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400"],
          merchantName: "张亮麻辣烫",
          tags: ["麻辣烫", "辣"],
          likeCount: 9,
          commentCount: 2,
          status: "published",
          aiVerified: "verified",
          postType: "recommend",
          createdAt: "2025-04-29T17:00:00Z",
          updatedAt: "2025-04-29T17:00:00Z",
          author: null,
          likedByMe: false
        }
      }
    ];
    
    return merchants;
  }

  async function openPost(id: string) {
    // mock模式：从本地状态查找帖子
    const post = posts.find(p => p.id === id);
    if (post) {
      setSelectedPost(post);
      // mock评论数据
      setComments([
        {
          id: "comment_1",
          postId: id,
          authorId: "user_demo_1",
          content: "看起来不错！",
          status: "published",
          aiVerified: "verified",
          credibilityScore: 88,
          credibilityLabel: "high",
          consumedCoins: 0,
          receiptImageUrl: null,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          author: { id: "user_demo_1", phone: "", nickname: "美食达人", avatarUrl: "", bio: "", status: "active", level: "gold", creditCoin: 1000, isMerchant: false, merchantStatus: "none", idCardVerified: true, warningCount: 0, createdAt: "", updatedAt: "" }
        },
        {
          id: "comment_2",
          postId: id,
          authorId: "user_demo_2",
          content: "下次我也去试试",
          status: "published",
          aiVerified: "verified",
          credibilityScore: 86,
          credibilityLabel: "high",
          consumedCoins: 0,
          receiptImageUrl: null,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          updatedAt: new Date(Date.now() - 7200000).toISOString(),
          author: { id: "user_demo_2", phone: "", nickname: "吃货小王", avatarUrl: "", bio: "", status: "active", level: "silver", creditCoin: 500, isMerchant: false, merchantStatus: "none", idCardVerified: false, warningCount: 0, createdAt: "", updatedAt: "" }
        }
      ]);
      setView("detail");
    }
  }

  function openBounty(id: string) {
    // mock模式：从本地状态查找悬赏
    const bounty = bounties.find(b => b.id === id);
    if (bounty) {
      setSelectedBounty(bounty);
      setView("bounty-detail");
    } else {
      flash("无法加载悬赏任务详情");
    }
  }

  // 从地图商家创建系统商家（直接使用mock数据，避免API调用失败）
  function createMerchantFromMap(mapMerchant: MapMerchant) {
    // 先关闭popup
    setMapPopupOpen(false);
    setSelectedMapMerchant(null);

    // 检查是否已存在系统商家
    const existingMerchant = merchants.find(m => m.businessName === mapMerchant.name);
    
    // 直接用模拟数据创建商家详情
    const mockMerchant: Merchant = {
      id: existingMerchant?.id || mapMerchant.id,
      userId: existingMerchant?.userId || "system",
      businessName: mapMerchant.name,
      businessAddress: mapMerchant.address,
      latitude: mapMerchant.latitude,
      longitude: mapMerchant.longitude,
      mapIcon: getIconByType(mapMerchant.type),
      status: "approved",
      aiVerified: "verified",
      createdAt: existingMerchant?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setSelectedMerchant(mockMerchant);
    // 转换MapMerchant的posts为Post类型
    const mockPosts: Post[] = mapMerchant.latestPost ? [mapMerchant.latestPost] : [];
    setMerchantPosts(mockPosts);
    setMerchantBounties([]);
    setMerchantPhotos(mapMerchant.photos.map(p => ({
      id: p.id,
      merchantId: mapMerchant.id,
      photoType: "dish",
      url: p.url,
      aiVerified: p.aiVerified,
      uploadedAt: new Date().toISOString()
    })));
    
    setView("merchant-detail");
  }
  
  async function uploadImage(dataUrl: string, purpose: "avatar" | "post-image" | "receipt") {
    const path = purpose === "avatar" ? "/files/avatar" : purpose === "receipt" ? "/files/receipt" : "/files/post-image";
    const data = await api<{ file: { url: string } }>(path, {
      method: "POST",
      body: JSON.stringify({ dataUrl })
    });
    return data.file.url;
  }

  async function logout(showMessage = true) {
    if (token) api("/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
    localStorage.removeItem("eattruth.token");
    setToken("");
    setUser(null);
    setView("home");
    if (showMessage) flash("已退出登录");
  }

  async function handleAuth(type: "login" | "register", event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = formValues(event.currentTarget);
    
    // 注册时先进行指纹验证
    if (type === "register") {
      setPendingRegisterData({
        phone: formData.phone as string,
        password: formData.password as string,
        nickname: formData.nickname as string
      });
      setView("fingerprint-register");
      return;
    }
    
    // 登录直接处理（mock模式）
    try {
      const formData2 = formData;
      const mockUser: User = {
        id: "user_" + Date.now(),
        phone: formData2.phone as string,
        nickname: "用户" + (formData2.phone as string).slice(-4),
        avatarUrl: "",
        bio: "",
        status: "active",
        level: "bronze",
        creditCoin: 100,
        isMerchant: false,
        merchantStatus: "none",
        idCardVerified: false,
        warningCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const mockToken = "mock_token_" + Date.now();
      setToken(mockToken);
      setUser(mockUser);
      localStorage.setItem("eattruth.token", mockToken);
      setView("home");
      flash("登录成功，获得5信用币");
    } catch (error) {
      flash((error as Error).message);
    }
  }
  
  // 指纹验证完成后完成注册（mock模式）
  function completeFingerprintRegister() {
    if (!pendingRegisterData) return;
    const mockUser: User = {
      id: "user_" + Date.now(),
      phone: pendingRegisterData.phone,
      nickname: pendingRegisterData.nickname,
      avatarUrl: "",
      bio: "",
      status: "active",
      level: "bronze",
      creditCoin: 50,
      isMerchant: false,
      merchantStatus: "none",
      idCardVerified: false,
      warningCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const mockToken = "mock_token_" + Date.now();
    setToken(mockToken);
    setUser(mockUser);
    localStorage.setItem("eattruth.token", mockToken);
    setPendingRegisterData(null);
    setView("home");
    flash("注册成功！指纹已绑定，账号已激活");
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = formValues(event.currentTarget).q?.trim() || "";
    setQuery(nextQuery);
    await loadPosts(nextQuery);
  }

  async function handleAvatar(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      // mock模式：直接更新头像
      setUser(prev => prev ? { ...prev, avatarUrl: dataUrl } : prev);
      flash("头像已更新");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      // mock模式：直接更新用户信息
      const values = formValues(event.currentTarget);
      setUser(prev => prev ? { ...prev, nickname: values.nickname || prev.nickname, bio: values.bio || prev.bio } : prev);
      flash("资料已更新");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  // 解析文本中的@商家
  function parseAtMerchants(text: string): { merchantId: string | null; merchantName: string | null } {
    const atPattern = /@([^\s@]+)/g;
    const matches = text.match(atPattern);
    
    if (matches) {
      for (const match of matches) {
        const merchantName = match.slice(1); // 去掉@符号
        const foundMerchant = merchants.find(m => 
          m.businessName === merchantName || 
          m.businessName.includes(merchantName) || 
          merchantName.includes(m.businessName)
        );
        if (foundMerchant) {
          return { merchantId: foundMerchant.id, merchantName: foundMerchant.businessName };
        }
      }
    }
    
    return { merchantId: null, merchantName: null };
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return setView("login");
    try {
      const values = formValues(event.currentTarget);
      
      // 解析@商家
      const allText = `${values.title || ""} ${values.content || ""}`;
      const { merchantId, merchantName: parsedMerchantName } = parseAtMerchants(allText);
      
      // 检查：商家不能给自己发帖子
      if (user?.isMerchant && merchantId) {
        const userMerchant = merchants.find(m => m.userId === user.id);
        if (userMerchant && userMerchant.id === merchantId) {
          throw new Error("商家不能给自己发帖子");
        }
      }
      
      // mock模式：直接创建帖子（临时允许无图片）
      const newPost: Post = {
        id: "post_" + Date.now(),
        authorId: user?.id || "user_mock",
        title: values.title,
        content: values.content,
        merchantId: merchantId || null,
        merchantName: parsedMerchantName || values.merchantName || "",
        postType: values.postType === "avoid" ? "avoid" : "recommend",
        tags: String(values.tags || "").split(/[，,\s]+/).filter(Boolean),
        coverImageUrl: imageDataUrl || "/img/beef-noodle.svg",
        imageUrls: imageDataUrl ? [imageDataUrl] : [],
        likeCount: 0,
        commentCount: 0,
        status: "published",
        aiVerified: "pending",
        likedByMe: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: user || { id: "user_mock", phone: "", nickname: "用户", avatarUrl: "", bio: "", status: "active", level: "bronze", creditCoin: 100, isMerchant: false, merchantStatus: "none", idCardVerified: false, warningCount: 0, createdAt: "", updatedAt: "" }
      };
      setImageDataUrl("");
      setPosts(prev => [newPost, ...prev]);
      openPost(newPost.id);
      flash("发布成功");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function toggleLike(post: Post) {
    if (!token) return setView("login");
    try {
      // mock模式：直接切换点赞状态
      const updatedPost = { 
        ...post, 
        likedByMe: !post.likedByMe, 
        likeCount: post.likedByMe ? post.likeCount - 1 : post.likeCount + 1 
      };
      setPosts((items) => items.map((item) => (item.id === post.id ? updatedPost : item)));
      if (selectedPost?.id === post.id) setSelectedPost(updatedPost);
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return setView("login");
    if (!selectedPost) return;
    try {
      const values = formValues(event.currentTarget);
      if (selectedPost.id.startsWith("p_")) {
        let receiptImageUrl: string | undefined;
        
        if (user?.level === "L1" && receiptDataUrl) {
          receiptImageUrl = await uploadImage(receiptDataUrl, "receipt");
        }
        
        const data = await api<{ comment: Comment; cost: number }>(`/posts/${selectedPost.id}/comments`, {
          method: "POST",
          body: JSON.stringify({ content: values.content, receiptImageUrl })
        });
        setReceiptDataUrl("");
        setPosts((items) =>
          items.map((item) =>
            item.id === selectedPost.id ? { ...item, commentCount: item.commentCount + 1 } : item
          )
        );
        await openPost(selectedPost.id);
        setComments((items) => (items.some((comment) => comment.id === data.comment.id) ? items : [...items, data.comment]));
        await refreshMe();
        await loadPosts().catch(() => {});
        await loadMyComments();
        await loadTransactions().catch(() => {});
      } else {
        const now = new Date().toISOString();
        const newComment: Comment = {
          id: "comment_" + Date.now(),
          postId: selectedPost.id,
          authorId: user?.id || "user_mock",
          content: values.content,
          status: "published",
          aiVerified: "pending",
          credibilityScore: 85,
          credibilityLabel: "high",
          consumedCoins: 0,
          receiptImageUrl: receiptDataUrl || null,
          createdAt: now,
          updatedAt: now,
          author: user || { id: "user_mock", phone: "", nickname: "用户", avatarUrl: "", bio: "", status: "active", level: "bronze", creditCoin: 100, isMerchant: false, merchantStatus: "none", idCardVerified: false, warningCount: 0, createdAt: "", updatedAt: "" }
        };
        setReceiptDataUrl("");
        setComments(prev => [...prev, newComment]);
        setPosts((items) =>
          items.map((item) =>
            item.id === selectedPost.id ? { ...item, commentCount: item.commentCount + 1 } : item
          )
        );
        setSelectedPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
      }
      flash("评论已发布");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function deleteComment(id: string) {
    if (!selectedPost) return;
    try {
      if (id.startsWith("c_")) {
        await api(`/comments/${id}`, { method: "DELETE", body: "{}" });
        await openPost(selectedPost.id);
        await loadPosts().catch(() => {});
        await loadMyComments();
      } else {
        setComments(prev => prev.filter(c => c.id !== id));
        setPosts((items) =>
          items.map((item) =>
            item.id === selectedPost.id ? { ...item, commentCount: Math.max(0, item.commentCount - 1) } : item
          )
        );
        setSelectedPost(prev => prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev);
      }
      flash("评论已删除");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function deletePost(id: string) {
    try {
      // mock模式：直接删除帖子
      setPosts(prev => prev.filter(p => p.id !== id));
      setView("home");
      flash("帖子已删除");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function publishBounty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return setView("login");
    try {
      const values = formValues(event.currentTarget);
      const rewardCoins = parseInt(values.rewardCoins) || 50;
      const deadlineDays = parseInt(values.deadlineDays) || 7;
      
      // 解析@商家
      const allText = `${values.merchantName || ""} ${values.description || ""}`;
      const { merchantId, merchantName: parsedMerchantName } = parseAtMerchants(allText);
      
      // 清理商家名称中的@符号
      const cleanMerchantName = (values.merchantName || "").replace(/@/g, "");
      
      // mock模式：直接创建悬赏数据
      const newBounty: Bounty = {
        id: "bounty_" + Date.now(),
        publisherId: user?.id || "user_mock",
        acceptorId: null,
        merchantId: merchantId || null,
        merchantName: parsedMerchantName || cleanMerchantName,
        merchantAddress: values.merchantAddress,
        description: values.description,
        imageUrls: [],
        rewardCoins,
        status: "active",
        aiVerified: "pending",
        deadline: new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setBounties(prev => [newBounty, ...prev]);
      setView("bounty");
      flash("悬赏发布成功");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function acceptBounty(bountyId: string) {
    if (!token) return setView("login");
    try {
      // mock模式：直接更新悬赏状态
      setBounties(prev => prev.map(b => 
        b.id === bountyId ? { ...b, acceptorId: user?.id || "user_mock", status: "accepted" } : b
      ));
      // 同步更新 selectedBounty
      setSelectedBounty(prev => prev?.id === bountyId ? { ...prev, acceptorId: user?.id || "user_mock", status: "accepted" } : prev);
      flash("已接取任务，请到详情页上传图片完成悬赏");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function submitBounty(event: FormEvent<HTMLFormElement>, bountyId: string) {
    event.preventDefault();
    if (!token || !imageDataUrl) {
      flash("请先上传图片");
      return;
    }
    try {
      const values = formValues(event.currentTarget);
      const submitDesc = values.submitDescription || "";
      
      setBounties(prev => prev.map(b => 
        b.id === bountyId ? { 
          ...b, 
          status: "completed", 
          submitDescription: submitDesc,
          submitImageUrls: [imageDataUrl]
        } : b
      ));
      setSelectedBounty(prev => prev?.id === bountyId ? { 
        ...prev, 
        status: "completed", 
        submitDescription: submitDesc,
        submitImageUrls: [imageDataUrl]
      } : prev);
      setImageDataUrl("");
      flash("任务完成，获得50信用币");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function applyMerchant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      flash("请先登录");
      setView("login");
      return;
    }
    try {
      // mock模式：直接更新用户状态
      setUser(prev => prev ? { ...prev, isMerchant: true, merchantStatus: "pending" } : prev);
      setView("merchant");
      flash("商家认证申请已提交，等待审核");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function uploadKitchenImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !imageDataUrl) {
      flash("请先上传图片");
      return;
    }
    try {
      // mock模式：直接成功
      setImageDataUrl("");
      flash("厨房照片上传成功");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function loadMerchantCoupons() {
    try {
      const data = await api<{ coupons: Coupon[] }>("/users/me/merchant/coupons");
      setMerchantCoupons(data.coupons);
    } catch (error) {
      console.error("Failed to load coupons:", error);
      setMerchantCoupons([]);
    }
  }

  async function uploadCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      flash("请先登录");
      return;
    }
    try {
      const values = formValues(event.currentTarget);
      await api("/merchants/coupons", {
        method: "POST",
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          type: values.type || "coupon",
          pointsCost: parseInt(values.pointsCost) || 50,
          originalPrice: values.originalPrice ? parseFloat(values.originalPrice) : null,
          discountValue: values.discountValue ? parseFloat(values.discountValue) : null,
          validityDays: parseInt(values.validityDays) || 30,
          stock: parseInt(values.stock) || 100,
          imageUrl: imageDataUrl || null,
          terms: values.terms || ""
        })
      });
      setImageDataUrl("");
      await loadMerchantCoupons();
      flash("优惠券创建成功");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function deleteCoupon(couponId: string) {
    try {
      await api(`/merchants/coupons/${couponId}`, { method: "DELETE" });
      await loadMerchantCoupons();
      flash("优惠券已删除");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  useEffect(() => {
    loadPosts().catch((error) => flash((error as Error).message));
    loadBounties().catch(() => {});
    loadMerchants().catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    // mock模式：有token就保持登录状态，不请求真实API
    if (!user) {
      setUser({
        id: "user_mock",
        phone: "13800000000",
        nickname: "用户0000",
        avatarUrl: "",
        bio: "",
        status: "active",
        level: "bronze",
        creditCoin: 100,
        isMerchant: false,
        merchantStatus: "none",
        idCardVerified: false,
        warningCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }, [token]);

  useEffect(() => {
    if (view === "credit" && user) {
      loadTransactions().catch(() => {});
    }
  }, [view, user]);

  useEffect(() => {
    if (view === "mine" && token) {
      loadMyBounties().catch(() => {});
      loadMyComments().catch(() => {});
    }
  }, [view, token]);

  useEffect(() => {
    if (view === "merchant" && token) {
      loadMerchantCenter().catch(() => {});
    }
  }, [view, token]);

  useEffect(() => {
    if (view === "ranking") {
      loadRankings(rankingTab);
    }
  }, [view, rankingTab]);

  useEffect(() => {
    if (view === "map") {
      loadMapMerchants().catch(() => {});
    }
  }, [view]);

  useEffect(() => {
    if (view === "merchant-photos" && user?.isMerchant) {
      loadMerchantPhotos().catch(() => {});
    }
    if (view === "merchant-coupons" && user?.isMerchant) {
      loadMerchantCoupons().catch(() => {});
    }
  }, [view, user]);

  useEffect(() => {
    if (view === "merchant-comments" && user?.isMerchant) {
      loadMerchantComments().catch(() => {});
    }
  }, [view, user]);

  useEffect(() => {
    if (view === "merchant-bounties" && user?.isMerchant) {
      loadMerchantBounties().catch(() => {});
    }
  }, [view, user]);

  return (
    <main className="phone">
      {message ? <div className="toast">{message}</div> : null}
      
      {view === "home" ? (
        <HomeView
          user={user}
          query={query}
          posts={searchResults || posts}
          postFilter={postFilter}
          onSearch={handleSearch}
          onFilterChange={(filter) => {
            setPostFilter(filter);
            loadPosts(query, filter);
          }}
          onGo={setView}
          onOpenPost={openPost}
          searchMerchants={searchMerchants}
          onOpenMerchantDetail={(merchantId) => {
            loadMerchantDetail(merchantId);
            setView("merchant-detail");
          }}
        />
      ) : null}
      
      {view === "detail" && selectedPost ? (
        <DetailView
          user={user}
          post={selectedPost}
          comments={comments}
          onGo={setView}
          onLike={toggleLike}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
          onDeletePost={deletePost}
          receiptDataUrl={receiptDataUrl}
          onPickReceipt={async (file) => setReceiptDataUrl(file ? await readFileAsDataUrl(file) : "")}
          onOpenMerchant={selectedPost.merchantId ? (merchantId) => {
            loadMerchantDetail(merchantId);
            setView("merchant-detail");
          } : undefined}
        />
      ) : null}
      
      {view === "publish" ? (
        <PublishView
          imageDataUrl={imageDataUrl}
          onPickImage={async (file) => setImageDataUrl(file ? await readFileAsDataUrl(file) : "")}
          onCreatePost={createPost}
          merchants={merchants}
        />
      ) : null}
      
      {view === "mine" ? (
        <MineView
          user={user}
          posts={myPosts}
          comments={myComments}
          myBounties={myBounties}
          onGo={setView}
          onOpenPost={openPost}
          onOpenBounty={openBounty}
          onAvatar={handleAvatar}
          onProfile={handleProfile}
          onLogout={logout}
        />
      ) : null}
      
      {view === "login" ? <AuthView type="login" onAuth={handleAuth} onGo={setView} /> : null}
      {view === "register" ? <AuthView type="register" onAuth={handleAuth} onGo={setView} /> : null}
      {view === "fingerprint-register" ? (
        <FingerprintRegisterView 
          onComplete={completeFingerprintRegister}
          onCancel={() => { setPendingRegisterData(null); setView("register"); }}
        />
      ) : null}
      
      {view === "bounty" ? (
        <BountyView
          user={user}
          bounties={bounties}
          myBounties={myBounties}
          onGo={setView}
          onOpenBounty={openBounty}
          onAcceptBounty={acceptBounty}
        />
      ) : null}
      
      {view === "bounty-publish" ? (
        <BountyPublishView onCreateBounty={publishBounty} onGo={setView} merchants={merchants} />
      ) : null}
      
      {view === "bounty-detail" && selectedBounty ? (
        <BountyDetailView
          user={user}
          bounty={selectedBounty}
          onGo={setView}
          onAccept={acceptBounty}
          onSubmit={submitBounty}
          imageDataUrl={imageDataUrl}
          onPickImage={async (file) => setImageDataUrl(file ? await readFileAsDataUrl(file) : "")}
        />
      ) : null}
      
      {view === "credit" ? (
        <CreditView
          user={user}
          transactions={transactions}
          onGo={setView}
        />
      ) : null}
      
      {view === "merchant" ? (
        <MerchantView
          user={user}
          merchant={merchant}
          posts={merchantPosts}
          bounties={merchantBounties}
          onGo={setView}
          onOpenPost={openPost}
          onOpenBounty={openBounty}
          imageDataUrl={imageDataUrl}
          onPickImage={async (file) => setImageDataUrl(file ? await readFileAsDataUrl(file) : "")}
          onUploadKitchen={uploadKitchenImage}
        />
      ) : null}
      
      {view === "merchant-apply" ? (
        <MerchantApplyView onApply={applyMerchant} onGo={setView} user={user} token={token} />
      ) : null}
      
      {view === "map" ? (
        <MapView 
          mapMerchants={mapMerchants} 
          merchantStarPoints={merchantStarPoints}
          merchantRewards={merchantRewards}
          onGo={setView} 
          onSelectMerchant={(merchant) => {
            setSelectedMapMerchant(merchant);
            setMapPopupOpen(true);
          }}
          onOpenMerchantDetail={(merchant) => {
            // 创建或更新系统商家数据
            createMerchantFromMap(merchant);
          }}
          onSelectRewardMerchant={(merchant) => {
            setSelectedRewardMerchant(merchant);
          }}
        />
      ) : null}
      
      {view === "ranking" ? (
        <RankingView
          rankings={rankings}
          rankingTab={rankingTab}
          onTabChange={setRankingTab}
          onGo={setView}
          onOpenMerchant={(merchant) => {
            // 直接使用榜单中的商家数据，不调用API
            setSelectedMerchant(merchant);
            // 生成模拟的商家帖子数据（匹配Post类型）
            const mockPosts: Post[] = [
              {
                id: `post_${merchant.id}_1`,
                authorId: "user_1",
                title: `${merchant.businessName} - 用户真实评价`,
                content: "这家店整体体验不错，食材新鲜，服务态度好。推荐尝试他们的招牌菜！",
                coverImageUrl: "",
                imageUrls: [],
                merchantName: merchant.businessName,
                tags: ["真实体验", "推荐"],
                likeCount: 12,
                commentCount: 5,
                status: "published",
                aiVerified: "verified",
                postType: "recommend",
                merchantId: merchant.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                author: { id: "user_1", phone: "", nickname: "美食达人", avatarUrl: "", bio: "", status: "active", level: "bronze", creditCoin: 100, isMerchant: false, merchantStatus: "", idCardVerified: false, warningCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                likedByMe: false
              },
              {
                id: `post_${merchant.id}_2`,
                authorId: "user_2",
                title: `${merchant.businessName} - 性价比分析`,
                content: "价格合理，分量足。环境干净整洁，服务员态度友好。唯一不足是高峰期等位时间较长。",
                coverImageUrl: "",
                imageUrls: [],
                merchantName: merchant.businessName,
                tags: ["性价比", "真实体验"],
                likeCount: 8,
                commentCount: 3,
                status: "published",
                aiVerified: "verified",
                postType: "recommend",
                merchantId: merchant.id,
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                updatedAt: new Date(Date.now() - 86400000).toISOString(),
                author: { id: "user_2", phone: "", nickname: "吃货小王", avatarUrl: "", bio: "", status: "active", level: "silver", creditCoin: 200, isMerchant: false, merchantStatus: "", idCardVerified: false, warningCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                likedByMe: false
              }
            ];
            setMerchantPosts(mockPosts);
            setMerchantBounties([]);
            setMerchantPhotos([]);
            setView("merchant-detail");
          }}
        />
      ) : null}
      
      {view === "merchant-detail" && selectedMerchant ? (
        <MerchantDetailView
          merchant={selectedMerchant}
          posts={merchantPosts}
          bounties={merchantBounties}
          photos={merchantPhotos}
          onGo={setView}
          onOpenPost={openPost}
          onOpenBounty={openBounty}
          user={user}
          onLoginRequired={() => setView("login")}
        />
      ) : null}
      
      {view === "merchant-photos" ? (
        <MerchantPhotosView
          photos={merchantPhotos}
          onGo={setView}
          onUploadPhoto={uploadMerchantPhoto}
          onDeletePhoto={deleteMerchantPhoto}
          imageDataUrl={imageDataUrl}
          onPickImage={async (file) => setImageDataUrl(file ? await readFileAsDataUrl(file) : "")}
        />
      ) : null}
      
      {view === "merchant-comments" ? (
        <MerchantCommentsView
          comments={merchantComments}
          onGo={setView}
          onReplyComment={replyComment}
        />
      ) : null}
      
      {view === "merchant-bounties" ? (
        <MerchantBountiesView
          bounties={merchantBountiesList}
          onGo={setView}
          onOpenBounty={openBounty}
        />
      ) : null}
      
      {view === "merchant-coupons" ? (
        <MerchantCouponsView
          coupons={merchantCoupons}
          onGo={setView}
          onUploadCoupon={uploadCoupon}
          onDeleteCoupon={deleteCoupon}
          imageDataUrl={imageDataUrl}
          onPickImage={async (file) => setImageDataUrl(file ? await readFileAsDataUrl(file) : "")}
        />
      ) : null}
      
      {view === "starpoints" && selectedRewardMerchant ? (
        <StarPointsView
          merchant={selectedRewardMerchant}
          starPoints={merchantStarPoints[selectedRewardMerchant.id]}
          rewards={merchantRewards[selectedRewardMerchant.id] || []}
          onGo={setView}
          onClaimReward={claimReward}
          user={user}
        />
      ) : null}
      
      <Tabbar view={view} user={user} onGo={setView} />
    </main>
  );
}

function HomeView({
  user,
  query,
  posts,
  postFilter,
  onSearch,
  onFilterChange,
  onGo,
  onOpenPost,
  searchMerchants,
  onOpenMerchantDetail
}: {
  user: User | null;
  query: string;
  posts: Post[];
  postFilter: "all" | "recommend" | "avoid";
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onFilterChange: (filter: "all" | "recommend" | "avoid") => void;
  onGo: (view: View) => void;
  onOpenPost: (id: string) => void;
  searchMerchants: Merchant[] | null;
  onOpenMerchantDetail: (merchantId: string) => void;
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <span className="eyebrow">食证圈</span>
          <h1>真实餐饮体验</h1>
        </div>
        {user ? (
          <div className="user-status">
            <img className="avatar" src={user.avatarUrl} alt="" onClick={() => onGo("mine")} />
            <div className="level-badge">{user.level}</div>
          </div>
        ) : (
          <button onClick={() => onGo("login")}>登录</button>
        )}
      </header>
      <form className="search" onSubmit={onSearch}>
        <input name="q" defaultValue={query} placeholder="搜索帖子、商家或标签" />
        <button type="submit">搜索</button>
      </form>
      <section className="tabs">
        <button 
          className={postFilter === "all" ? "active" : ""} 
          onClick={() => onFilterChange("all")}
        >
          全部
        </button>
        <button 
          className={postFilter === "recommend" ? "active" : ""} 
          onClick={() => onFilterChange("recommend")}
        >
          推荐
        </button>
        <button 
          className={postFilter === "avoid" ? "active" : ""} 
          onClick={() => onFilterChange("avoid")}
        >
          避雷
        </button>
      </section>
      
      {/* 商家搜索结果 */}
      {query && searchMerchants && searchMerchants.length > 0 && (
        <section className="merchant-search-results">
          <h2 className="section-title">🏪 相关商家</h2>
          <div className="merchant-list">
            {searchMerchants.map((merchant) => (
              <article 
                key={merchant.id} 
                className="merchant-card"
                onClick={() => onOpenMerchantDetail(merchant.id)}
              >
                <div className="merchant-info">
                  <h3>{merchant.businessName}</h3>
                  <p className="merchant-address">{merchant.businessAddress}</p>
                </div>
                <div className="merchant-action">
                  <span className="go-btn">→</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      
      {/* 帖子搜索结果 */}
      <section className="feed">
        {query && posts.length === 0 && (!searchMerchants || searchMerchants.length === 0) ? (
          <Empty text="没有找到相关内容" />
        ) : query && posts.length > 0 ? (
          <>
            <h2 className="section-title">📝 相关帖子</h2>
            {posts.map((post) => <PostCard key={post.id} post={post} onOpenPost={onOpenPost} />)}
          </>
        ) : posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} onOpenPost={onOpenPost} />)
        ) : (
          <Empty text="还没有帖子" />
        )}
      </section>
    </>
  );
}

function AuthView({
  type,
  onAuth,
  onGo
}: {
  type: "login" | "register";
  onAuth: (type: "login" | "register", event: FormEvent<HTMLFormElement>) => void;
  onGo: (view: View) => void;
}) {
  const isLogin = type === "login";
  return (
    <section className="panel">
      <h1>{isLogin ? "登录" : "注册"}</h1>
      <form className="form" onSubmit={(event) => onAuth(type, event)}>
        <label>
          手机号
          <input name="phone" defaultValue={isLogin ? "13800000000" : ""} required />
        </label>
        <label>
          密码
          <input name="password" type="password" defaultValue={isLogin ? "123456" : ""} minLength={6} required />
        </label>
        {isLogin ? null : (
          <label>
            昵称
            <input name="nickname" required />
          </label>
        )}
        <button className="primary" type="submit">
          {isLogin ? "登录" : "注册"}
        </button>
      </form>
      <button className="text-button" onClick={() => onGo(isLogin ? "register" : "login")}>
        {isLogin ? "还没有账号，去注册" : "已有账号，去登录"}
      </button>
    </section>
  );
}

// 指纹注册验证组件
function FingerprintRegisterView({
  onComplete,
  onCancel
}: {
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"ready" | "verifying" | "success" | "error">("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // 清理计时器
  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  
  // 组件卸载时清理
  useEffect(() => {
    return () => clearTimer();
  }, []);
  
  const handlePressStart = () => {
    if (status !== "ready" && status !== "verifying") return;
    setPressing(true);
    setStatus("verifying");
    clearTimer();
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + 2;
        if (next >= 100) {
          clearTimer();
          setStatus("success");
          setPressing(false);
          setTimeout(() => {
            onComplete();
          }, 600);
          return 100;
        }
        return next;
      });
    }, 50);
  };
  
  const handlePressEnd = () => {
    setPressing(false);
    if (status === "verifying" && progress < 100) {
      clearTimer();
      setStatus("error");
      setErrorMessage("请保持按压直到验证完成");
      setProgress(0);
      setTimeout(() => {
        setStatus("ready");
        setErrorMessage("");
      }, 1500);
    }
  };
  
  return (
    <section className="panel fingerprint-panel">
      <h1>指纹注册</h1>
      <p className="fingerprint-subtitle">为防止水军刷号，请完成指纹验证</p>
      
      <div className="fingerprint-container">
        {/* 右手图标 */}
        <div className="hand-indicator">
          <span className="hand-icon">🤚</span>
          <span className="hand-label">右手</span>
        </div>
        
        {/* 指纹扫描区域 */}
        <div 
          className={`fingerprint-scanner ${status} ${pressing ? "pressing" : ""}`}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
        >
          <div className="fingerprint-icon">
            {/* 指纹SVG */}
            <svg viewBox="0 0 100 100" className="fingerprint-svg">
              <defs>
                <linearGradient id="fingerprint-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              {/* 指纹纹路 */}
              <path d="M50 10 Q30 20 30 50 Q30 80 50 90 Q70 80 70 50 Q70 20 50 10" fill="none" stroke="url(#fingerprint-gradient)" strokeWidth="2" opacity="0.8"/>
              <path d="M50 20 Q35 30 35 50 Q35 70 50 80 Q65 70 65 50 Q65 30 50 20" fill="none" stroke="url(#fingerprint-gradient)" strokeWidth="2" opacity="0.7"/>
              <path d="M50 30 Q40 38 40 50 Q40 62 50 70 Q60 62 60 50 Q60 38 50 30" fill="none" stroke="url(#fingerprint-gradient)" strokeWidth="2" opacity="0.6"/>
              <path d="M50 40 Q45 45 45 50 Q45 55 50 60 Q55 55 55 50 Q55 45 50 40" fill="none" stroke="url(#fingerprint-gradient)" strokeWidth="2" opacity="0.5"/>
              {/* 大拇指标记 */}
              <circle cx="50" cy="50" r="8" fill="url(#fingerprint-gradient)" opacity="0.3"/>
            </svg>
          </div>
          
          {/* 扫描线动画 */}
          {status === "verifying" && (
            <div className="scan-line" style={{ top: `${progress}%` }} />
          )}
          
          {/* 进度环 */}
          <svg className="progress-ring" viewBox="0 0 100 100">
            <circle 
              cx="50" cy="50" r="45" 
              fill="none" 
              stroke="#e5e7eb" 
              strokeWidth="4"
            />
            <circle 
              cx="50" cy="50" r="45" 
              fill="none" 
              stroke="url(#fingerprint-gradient)" 
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.83} 283`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          
          {/* 状态图标 */}
          {status === "success" && <div className="status-icon success">✓</div>}
          {status === "error" && <div className="status-icon error">✗</div>}
        </div>
        
        {/* 大拇指提示 */}
        <div className="thumb-label">
          <span className="thumb-icon">👍</span>
          <span>大拇指</span>
        </div>
      </div>
      
      {/* 状态提示 */}
      <div className="fingerprint-status">
        {status === "ready" && <p>请长按指纹区域进行验证</p>}
        {status === "verifying" && <p className="verifying">正在验证中... {progress}%</p>}
        {status === "success" && <p className="success">验证成功！</p>}
        {status === "error" && <p className="error">{errorMessage}</p>}
      </div>
      
      {/* 说明 */}
      <div className="fingerprint-notice">
        <h4>📋 指纹注册说明</h4>
        <ul>
          <li>指纹将用于识别唯一用户，防止水军刷号</li>
          <li>每个指纹只能注册一个账号</li>
          <li>指纹数据仅用于身份验证，不会用于其他用途</li>
          <li>请使用右手大拇指进行注册</li>
        </ul>
      </div>
      
      <button className="text-button cancel-btn" onClick={onCancel}>
        取消注册
      </button>
    </section>
  );
}

function DetailView({
  user,
  post,
  comments,
  onGo,
  onLike,
  onAddComment,
  onDeleteComment,
  onDeletePost,
  receiptDataUrl,
  onPickReceipt,
  onOpenMerchant
}: {
  user: User | null;
  post: Post;
  comments: Comment[];
  onGo: (view: View) => void;
  onLike: (post: Post) => void;
  onAddComment: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteComment: (id: string) => void;
  onDeletePost: (id: string) => void;
  receiptDataUrl: string;
  onPickReceipt: (file: File | undefined) => void;
  onOpenMerchant?: (merchantId: string) => void;
}) {
  const needReceipt = user?.level === "L1";
  
  return (
    <>
      <button className="back" onClick={() => onGo("home")}>
        ← 首页
      </button>
      <article className="detail">
        <img className="hero-image" src={post.coverImageUrl} alt="" />
        <div className="detail-body">
          <div className="author-row">
            <img className="avatar" src={post.author?.avatarUrl} alt="" />
            <div>
              <div className="author-info">
                <strong>{post.author?.nickname || "匿名用户"}</strong>
                <span className="level-tag">{post.author?.level}</span>
              </div>
              {post.merchantName && (
                <p 
                  className={post.merchantId ? "merchant-link" : ""}
                  onClick={post.merchantId && onOpenMerchant ? () => onOpenMerchant(post.merchantId!) : undefined}
                >
                  {post.postType === "recommend" ? "👍 推荐: " : post.postType === "avoid" ? "⚠️ 避雷: " : ""}
                  {post.merchantName}
                </p>
              )}
            </div>
          </div>
          <h1>{post.title}</h1>
          <p>{post.content}</p>
          <div className="tags">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="ai-badge" data-status={post.aiVerified}>
            {post.aiVerified === "verified" ? "✓ AI已验真" : post.aiVerified === "fake" ? "✗ 疑似虚假" : "待验真"}
          </div>
          <div className="actions">
            <button className={post.likedByMe ? "liked" : ""} onClick={() => onLike(post)}>
              {post.likedByMe ? "已点赞" : "点赞"} · {post.likeCount}
            </button>
            {user?.id === post.authorId ? (
              <button className="danger" onClick={() => onDeletePost(post.id)}>
                删除帖子
              </button>
            ) : null}
          </div>
        </div>
      </article>
      <section className="comments">
        <h2>评论</h2>
        {comments.length ? (
          comments.map((comment) => (
            <div className="comment" key={comment.id}>
              <div>
                <div className="comment-author">
                  <strong>{comment.author?.nickname}</strong>
                  <span className="level-tag small">{comment.author?.level}</span>
                </div>
                <p>{comment.content}</p>
                <div className="comment-meta">
                  <span className="ai-badge mini" data-status={comment.aiVerified}>
                    {comment.aiVerified === "verified" ? "已验真" : comment.aiVerified === "fake" ? "疑似水军" : "待验真"}
                  </span>
                  {comment.consumedCoins > 0 && <span>消耗{comment.consumedCoins}币</span>}
                  {comment.receiptImageUrl && <span>有消费截图</span>}
                </div>
              </div>
              {user?.id === comment.authorId ? <button onClick={() => onDeleteComment(comment.id)}>删除</button> : null}
            </div>
          ))
        ) : (
          <Empty text="暂无评论" />
        )}
        <form className="comment-form" onSubmit={onAddComment}>
          {needReceipt && (
            <div className="receipt-upload">
              <input type="file" accept="image/*" onChange={(event) => onPickReceipt(event.currentTarget.files?.[0])} />
              {receiptDataUrl ? <img className="receipt-preview" src={receiptDataUrl} alt="" /> : <span>L1用户需上传消费截图</span>}
            </div>
          )}
          <input name="content" placeholder={user ? "写下你的真实体验" : "登录后评论"} disabled={!user} />
          <button type="submit">发送</button>
        </form>
      </section>
    </>
  );
}

function PublishView({
  imageDataUrl,
  onPickImage,
  onCreatePost,
  merchants
}: {
  imageDataUrl: string;
  onPickImage: (file: File | undefined) => void;
  onCreatePost: (event: FormEvent<HTMLFormElement>) => void;
  merchants: Merchant[];
}) {
  return (
    <section className="panel">
      <button className="back" onClick={() => history.back()}>← 返回</button>
      <h1>发布帖子</h1>
      <form className="form" onSubmit={onCreatePost}>
        <label>
          图片
          <input type="file" accept="image/*" onChange={(event) => onPickImage(event.currentTarget.files?.[0])} />
        </label>
        {imageDataUrl ? <img className="preview" src={imageDataUrl} alt="" /> : null}
        <label>
          标题
          <input name="title" required placeholder="可以使用 @商家名 来关联商家" />
        </label>
        <label>
          正文
          <textarea name="content" required placeholder="可以使用 @商家名 来关联商家，如：@好吃餐厅 的牛肉面很好吃" />
        </label>
        <label>
          帖子类型
          <select name="postType" defaultValue="recommend">
            <option value="recommend">👍 推荐</option>
            <option value="avoid">⚠️ 避雷</option>
          </select>
        </label>
        <div className="at-merchant-section">
          <p className="hint">💡 快捷@商家：</p>
          <div className="merchant-tags">
            {merchants.slice(0, 5).map((merchant) => (
              <button
                key={merchant.id}
                type="button"
                className="merchant-tag"
                onClick={(e) => {
                  e.preventDefault();
                  const contentInput = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
                  if (contentInput) {
                    contentInput.value += `@${merchant.businessName} `;
                    contentInput.focus();
                  }
                }}
              >
                @{merchant.businessName}
              </button>
            ))}
          </div>
        </div>
        <label>
          标签
          <input name="tags" placeholder="牛肉面, 午餐, 实拍" />
        </label>
        <button className="primary" type="submit">
          发布
        </button>
      </form>
    </section>
  );
}

function MineView({
  user,
  posts,
  comments,
  myBounties,
  onGo,
  onOpenPost,
  onOpenBounty,
  onAvatar,
  onProfile,
  onLogout
}: {
  user: User | null;
  posts: Post[];
  comments: Comment[];
  myBounties: Bounty[];
  onGo: (view: View) => void;
  onOpenPost: (id: string) => void;
  onOpenBounty: (id: string) => void;
  onAvatar: (file: File | undefined) => void;
  onProfile: (event: FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
}) {
  if (!user) return <AuthView type="login" onAuth={() => undefined} onGo={onGo} />;
  
  return (
    <>
      <section className="profile">
        <img className="profile-avatar" src={user.avatarUrl} alt="" />
        <div>
          <div className="user-header">
            <h1>{user.nickname}</h1>
            <span className="level-badge large">{user.level}</span>
          </div>
          <p>{user.bio || "还没有简介"}</p>
          <div className="credit-display">
            <div className="credit-item">
              <span className="credit-icon">💰</span>
              <span className="credit-value">{user.creditCoin}</span>
              <span className="credit-label">信用币</span>
            </div>
            <button className="credit-button" onClick={() => onGo("credit")}>查看明细</button>
          </div>
        </div>
      </section>
      
      <section className="user-badges">
        {user.idCardVerified && <span className="badge">已实名</span>}
        {user.isMerchant && <span className="badge merchant">{user.merchantStatus}</span>}
        {user.warningCount > 0 && <span className="badge warning">警告{user.warningCount}次</span>}
      </section>
      
      <section className="panel">
        <h2>个人资料</h2>
        <label className="file-line">
          上传头像
          <input type="file" accept="image/*" onChange={(event) => onAvatar(event.currentTarget.files?.[0])} />
        </label>
        <form className="form" onSubmit={onProfile}>
          <label>
            昵称
            <input name="nickname" defaultValue={user.nickname} />
          </label>
          <label>
            简介
            <textarea name="bio" defaultValue={user.bio || ""} />
          </label>
          <button className="primary" type="submit">
            保存资料
          </button>
        </form>
      </section>
      
      <section className="quick-actions">
        <button onClick={() => onGo(user.isMerchant ? "merchant" : "merchant-apply")}>
          {user.isMerchant ? "商家中心" : "申请商家认证"}
        </button>
      </section>
      
      <section>
        <h2>我的悬赏任务</h2>
        <div className="bounty-list">
          {myBounties.length ? (
            myBounties.map((bounty) => (
              <div className="bounty-card" key={bounty.id} onClick={() => onOpenBounty(bounty.id)}>
                <div className="bounty-header">
                  <div className="bounty-merchant">
                    <h3>{bounty.merchantName}</h3>
                    <p>{bounty.merchantAddress}</p>
                  </div>
                  <div className="bounty-reward">
                    <span className="reward-amount">{bounty.rewardCoins}</span>
                    <span className="reward-label">信用币</span>
                  </div>
                </div>
                <p className="bounty-desc">{bounty.description}</p>
                {bounty.status === "completed" && (
                  <div className="submit-content">
                    <h4>任务提交内容</h4>
                    {bounty.submitDescription && (
                      <p className="submit-desc">{bounty.submitDescription}</p>
                    )}
                    {bounty.submitImageUrls && bounty.submitImageUrls.length > 0 && (
                      <div className="submit-images">
                        {bounty.submitImageUrls.map((img, idx) => (
                          <img key={idx} src={img} alt="" className="submit-image" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="bounty-footer">
                  <span className={`status-tag ${bounty.status}`}>
                    {bounty.status === "active" ? "待接取" : bounty.status === "accepted" ? "进行中" : bounty.status === "completed" ? "已完成" : "已失败"}
                  </span>
                  <span>{bounty.publisherId === user.id ? "我发布的" : "我接取的"}</span>
                </div>
              </div>
            ))
          ) : (
            <Empty text="还没有悬赏任务" />
          )}
        </div>
      </section>

      <section>
        <h2>我的评论</h2>
        <div className="comment-history-list">
          {comments.length ? (
            comments.map((comment) => (
              <article className="comment-history-card" key={comment.id} onClick={() => comment.post && onOpenPost(comment.post.id)}>
                <div className="comment-history-head">
                  <div>
                    <strong>{comment.post?.merchantName || "未关联商家"}</strong>
                    <span>{comment.post?.title || "原帖"}</span>
                  </div>
                  <time>{new Date(comment.createdAt).toLocaleDateString()}</time>
                </div>
                <p>{comment.content}</p>
                <div className="comment-meta">
                  <span className="ai-badge mini" data-status={comment.aiVerified}>
                    {aiLabel(comment.aiVerified)}
                  </span>
                  <span className="credibility-badge" data-level={comment.credibilityLabel || "high"}>
                    可信度 {comment.credibilityScore ?? 85}% · {credibilityLabel(comment.credibilityLabel)}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <Empty text="还没有评论记录" />
          )}
        </div>
      </section>
      
      <section>
        <h2>我的帖子</h2>
        <div className="feed">
          {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} onOpenPost={onOpenPost} />) : <Empty text="还没有发布内容" />}
        </div>
      </section>
      
      <button className="danger full" onClick={onLogout}>
        退出登录
      </button>
    </>
  );
}

function BountyView({
  user,
  bounties,
  myBounties,
  onGo,
  onOpenBounty,
  onAcceptBounty
}: {
  user: User | null;
  bounties: Bounty[];
  myBounties: Bounty[];
  onGo: (view: View) => void;
  onOpenBounty: (id: string) => void;
  onAcceptBounty: (id: string) => void;
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <span className="eyebrow">悬赏任务</span>
          <h1>探店验证</h1>
        </div>
        {user && <button className="primary small" onClick={() => onGo("bounty-publish")}>发布悬赏</button>}
      </header>
      
      <section className="tabs">
        <button className="active">全部悬赏</button>
        <button onClick={() => onGo("mine")}>我的参与</button>
      </section>
      
      <section className="feed">
        {bounties.length ? (
          bounties.map((bounty) => (
            <div className="bounty-card" key={bounty.id} onClick={() => onOpenBounty(bounty.id)}>
              <div className="bounty-header">
                <div className="bounty-merchant">
                  <h3>{bounty.merchantName}</h3>
                  <p>{bounty.merchantAddress}</p>
                </div>
                <div className="bounty-reward">
                  <span className="reward-amount">{bounty.rewardCoins}</span>
                  <span className="reward-label">信用币</span>
                </div>
              </div>
              <p className="bounty-desc">{bounty.description}</p>
              <div className="bounty-footer">
                <span>{bounty.status === "active" ? "可接取" : bounty.status === "accepted" ? "进行中" : "已完成"}</span>
                <span>发布于 {new Date(bounty.createdAt).toLocaleDateString()}</span>
              </div>
              {user && bounty.status === "active" && (
                <button className="accept-btn" onClick={(e) => { e.stopPropagation(); onAcceptBounty(bounty.id); }}>
                  接取任务
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty text="暂无悬赏任务" />
        )}
      </section>
    </>
  );
}

function BountyPublishView({
  onCreateBounty,
  onGo,
  merchants
}: {
  onCreateBounty: (event: FormEvent<HTMLFormElement>) => void;
  onGo: (view: View) => void;
  merchants: Merchant[];
}) {
  return (
    <section className="panel">
      <button className="back" onClick={() => onGo("bounty")}>← 返回</button>
      <h1>发布悬赏</h1>
      <form className="form" onSubmit={onCreateBounty}>
        <label>
          商家名称
          <input name="merchantName" required placeholder="可以使用 @商家名 来关联商家" />
        </label>
        <label>
          商家地址
          <input name="merchantAddress" required />
        </label>
        <div className="at-merchant-section">
          <p className="hint">💡 快捷@商家：</p>
          <div className="merchant-tags">
            {merchants.slice(0, 5).map((merchant) => (
              <button
                key={merchant.id}
                type="button"
                className="merchant-tag"
                onClick={(e) => {
                  e.preventDefault();
                  const nameInput = document.querySelector('input[name="merchantName"]') as HTMLInputElement;
                  if (nameInput) {
                    nameInput.value = `@${merchant.businessName}`;
                    nameInput.focus();
                  }
                }}
              >
                @{merchant.businessName}
              </button>
            ))}
          </div>
        </div>
        <label>
          任务描述
          <textarea name="description" required placeholder="可以使用 @商家名 来关联商家" />
        </label>
        <label>
          奖励信用币
          <input name="rewardCoins" type="number" defaultValue="50" min="10" max="500" />
        </label>
        <label>
          截止天数
          <input name="deadlineDays" type="number" defaultValue="7" min="1" max="30" />
        </label>
        <button className="primary" type="submit">
          发布悬赏
        </button>
      </form>
    </section>
  );
}

function BountyDetailView({
  user,
  bounty,
  onGo,
  onAccept,
  onSubmit,
  imageDataUrl,
  onPickImage
}: {
  user: User | null;
  bounty: Bounty;
  onGo: (view: View) => void;
  onAccept: (id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, id: string) => void;
  imageDataUrl: string;
  onPickImage: (file: File | undefined) => void;
}) {
  const isAcceptor = user?.id === bounty.acceptorId;
  const canSubmit = isAcceptor && bounty.status === "accepted";
  
  return (
    <>
      <button className="back" onClick={() => onGo("bounty")}>← 返回</button>
      <section className="panel">
        <div className="bounty-detail-header">
          <div>
            <h1>{bounty.merchantName}</h1>
            <p>{bounty.merchantAddress}</p>
          </div>
          <div className="bounty-badge">{bounty.status}</div>
        </div>
        
        <div className="reward-display">
          <span className="reward-icon">💰</span>
          <span className="reward-value">{bounty.rewardCoins}</span>
          <span className="reward-label">信用币奖励</span>
        </div>
        
        <div className="bounty-info">
          <h2>任务描述</h2>
          <p>{bounty.description}</p>
        </div>
        
        {bounty.status === "accepted" && (
          <div className="bounty-info deadline">
            <h2>截止时间</h2>
            <p className="deadline-text">
              {new Date(bounty.deadline) > new Date() 
                ? `剩余 ${Math.ceil((new Date(bounty.deadline).getTime() - Date.now()) / (1000*60*60*24))} 天`
                : "已过期"}
            </p>
          </div>
        )}
        
        <div className="bounty-info">
          <h2>发布者</h2>
          <div className="user-mini">
            <img className="avatar" src={bounty.publisher?.avatarUrl} alt="" />
            <span>{bounty.publisher?.nickname}</span>
          </div>
        </div>
        
        {bounty.acceptor && (
          <div className="bounty-info">
            <h2>接取者</h2>
            <div className="user-mini">
              <img className="avatar" src={bounty.acceptor.avatarUrl} alt="" />
              <span>{bounty.acceptor.nickname}</span>
            </div>
          </div>
        )}
        
        {bounty.status === "completed" && (
          <div className="bounty-info">
            <h2>任务提交内容</h2>
            {bounty.submitDescription && (
              <div className="submit-desc-section">
                <p className="submit-desc">{bounty.submitDescription}</p>
              </div>
            )}
            {bounty.submitImageUrls && bounty.submitImageUrls.length > 0 && (
              <div className="submit-images-section">
                {bounty.submitImageUrls.map((img, idx) => (
                  <img key={idx} src={img} alt="" className="submit-image" />
                ))}
              </div>
            )}
            {!bounty.submitDescription && (!bounty.submitImageUrls || bounty.submitImageUrls.length === 0) && (
              <p className="empty-submit">暂无提交内容</p>
            )}
          </div>
        )}
        
        {canSubmit && (
          <div className="submit-section">
            <h2>提交任务</h2>
            <form className="form" onSubmit={(e) => onSubmit(e, bounty.id)}>
              <label>
                任务描述（选填）
                <textarea name="submitDescription" placeholder="补充描述任务完成情况..." rows={3} />
              </label>
              <label>
                上传现场图片
                <input type="file" accept="image/*" onChange={(event) => onPickImage(event.currentTarget.files?.[0])} />
              </label>
              {imageDataUrl ? <img className="preview" src={imageDataUrl} alt="" /> : null}
              <button className="primary" type="submit">
                提交任务
              </button>
            </form>
          </div>
        )}
        
        {!isAcceptor && bounty.status === "active" && user && (
          <button className="primary full" onClick={() => onAccept(bounty.id)}>
            接取任务
          </button>
        )}
      </section>
    </>
  );
}

function CreditView({
  user,
  transactions,
  onGo
}: {
  user: User | null;
  transactions: Transaction[];
  onGo: (view: View) => void;
}) {
  return (
    <>
      <button className="back" onClick={() => onGo("mine")}>← 返回</button>
      <section className="panel">
        <h1>信用币明细</h1>
        <div className="credit-summary">
          <div className="credit-total">
            <span className="total-label">当前余额</span>
            <span className="total-value">{user?.creditCoin || 0}</span>
            <span className="total-unit">信用币</span>
          </div>
        </div>
        
        <h2>交易记录</h2>
        {transactions.length ? (
          <div className="transaction-list">
            {transactions.map((tx) => (
              <div className="transaction-item" key={tx.id}>
                <div className="tx-info">
                  <span className="tx-reason">{tx.reason}</span>
                  <span className="tx-date">{new Date(tx.createdAt).toLocaleString()}</span>
                </div>
                <span className={`tx-amount ${tx.amount > 0 ? "positive" : "negative"}`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="暂无交易记录" />
        )}
      </section>
      
      <section className="panel">
        <h2>等级规则</h2>
        <div className="level-rules">
          <div className="level-item">
            <span className="level-name">L0 路人</span>
            <span className="level-desc">初始等级，不可评论</span>
          </div>
          <div className="level-item">
            <span className="level-name">L1 美食小白</span>
            <span className="level-desc">50信用币，评论消耗10币，需消费截图</span>
          </div>
          <div className="level-item">
            <span className="level-name">L10 可信用户</span>
            <span className="level-desc">100信用币，评论消耗5币，推流更多</span>
          </div>
          <div className="level-item">
            <span className="level-name">L100 超级信用大王</span>
            <span className="level-desc">200信用币，评论免费，可信度最高</span>
          </div>
        </div>
      </section>
    </>
  );
}

function MerchantView({
  user,
  merchant,
  posts,
  bounties,
  onGo,
  onOpenPost,
  onOpenBounty,
  imageDataUrl,
  onPickImage,
  onUploadKitchen
}: {
  user: User | null;
  merchant: Merchant | null;
  posts: Post[];
  bounties: Bounty[];
  onGo: (view: View) => void;
  onOpenPost: (id: string) => void;
  onOpenBounty: (id: string) => void;
  imageDataUrl: string;
  onPickImage: (file: File | undefined) => void;
  onUploadKitchen: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!user?.isMerchant) {
    return (
      <section className="panel">
        <button className="back" onClick={() => onGo("mine")}>← 返回</button>
        <h1>商家中心</h1>
        <p>您还不是商家用户，请先申请认证</p>
        <button className="primary" onClick={() => onGo("merchant-apply")}>
          申请商家认证
        </button>
      </section>
    );
  }
  
  return (
    <>
      <button className="back" onClick={() => onGo("mine")}>← 返回</button>
      <section className="panel">
        <h1>商家中心</h1>
        
        <div className="merchant-status">
          <span className={`status-badge ${user.merchantStatus}`}>
            {user.merchantStatus === "approved" ? "已通过" : user.merchantStatus === "pending" ? "审核中" : "未通过"}
          </span>
        </div>

        {merchant ? (
          <div className="merchant-profile">
            <strong>{merchant.businessName}</strong>
            <span>{merchant.businessAddress}</span>
          </div>
        ) : null}
        
        <div className="merchant-section">
          <h2>每月后厨上传</h2>
          <form className="form" onSubmit={onUploadKitchen}>
            <label>
              上传后厨图片
              <input type="file" accept="image/*" onChange={(event) => onPickImage(event.currentTarget.files?.[0])} />
            </label>
            {imageDataUrl ? <img className="preview" src={imageDataUrl} alt="" /> : null}
            <button className="primary" type="submit">
              上传并检测
            </button>
            <p className="hint">每月上传可获得50信用币奖励</p>
          </form>
        </div>

        <div className="merchant-section">
          <h2>关联帖子</h2>
          <div className="feed">
            {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} onOpenPost={onOpenPost} />) : <Empty text="还没有用户 @ 该商家的帖子" />}
          </div>
        </div>

        <div className="merchant-section">
          <h2>关联悬赏</h2>
          <div className="bounty-list">
            {bounties.length ? (
              bounties.map((bounty) => (
                <div className="bounty-card" key={bounty.id} onClick={() => onOpenBounty(bounty.id)}>
                  <div className="bounty-header">
                    <div className="bounty-merchant">
                      <h3>{bounty.merchantName}</h3>
                      <p>{bounty.merchantAddress}</p>
                    </div>
                    <div className="bounty-reward">
                      <span className="reward-amount">{bounty.rewardCoins}</span>
                      <span className="reward-label">信用币</span>
                    </div>
                  </div>
                  <p className="bounty-desc">{bounty.description}</p>
                  <div className="bounty-footer">
                    <span className={`status-tag ${bounty.status}`}>{bountyStatusLabel(bounty.status)}</span>
                    <span>{new Date(bounty.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <Empty text="还没有用户 @ 该商家的悬赏" />
            )}
          </div>
        </div>
        
        <div className="merchant-section">
          <h2>商家专属功能</h2>
          <div className="feature-list">
            <div className="feature-item clickable" onClick={() => onGo("merchant-photos")}>
              <span className="feature-icon">📷</span>
              <span>商家自传图管理</span>
            </div>
            <div className="feature-item clickable" onClick={() => onGo("merchant-comments")}>
              <span className="feature-icon">💬</span>
              <span>消费者评论管理</span>
            </div>
            <div className="feature-item clickable" onClick={() => onGo("merchant-bounties")}>
              <span className="feature-icon">💰</span>
              <span>被悬赏记录</span>
            </div>
            <div className="feature-item clickable" onClick={() => onGo("merchant-coupons")}>
              <span className="feature-icon">🎫</span>
              <span>优惠券管理</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function MerchantApplyView({
  onApply,
  onGo,
  user,
  token
}: {
  onApply: (event: FormEvent<HTMLFormElement>) => void;
  onGo: (view: View) => void;
  user: User | null;
  token: string;
}) {
  // 如果有 user 就直接显示表单，不管 token（兼容 mock 模式）
  if (user) {
    return (
      <section className="panel">
        <button className="back" onClick={() => onGo("mine")}>← 返回</button>
        <h1>商家认证申请</h1>
        <form className="form" onSubmit={onApply}>
          <label>
            商家名称
            <input name="businessName" required />
          </label>
          <label>
            商家地址
            <input name="businessAddress" required />
          </label>
          <label>
            营业执照号（选填）
            <input name="businessLicense" />
          </label>
          <button className="primary" type="submit">
            提交申请
          </button>
        </form>
      </section>
    );
  }
  
  // 否则提示登录
  return (
    <section className="panel">
      <button className="back" onClick={() => onGo("mine")}>← 返回</button>
      <h1>商家认证申请</h1>
      <p>请先登录后再申请商家认证</p>
      <button className="primary" onClick={() => onGo("login")}>
        去登录
      </button>
    </section>
  );
}

function PostCard({ post, onOpenPost }: { post: Post; onOpenPost: (id: string) => void }) {
  const coverUrl = post.coverImageUrl || post.imageUrls[0] || "";
  return (
    <article className="post-card" onClick={() => onOpenPost(post.id)}>
      {coverUrl ? (
        <img className="post-cover" src={coverUrl} alt="" />
      ) : (
        <div className="post-cover-placeholder">
          <span className="placeholder-icon">📷</span>
          <span className="placeholder-text">暂无图片</span>
        </div>
      )}
      <div className="post-body">
        <div className="post-type-badge">
          {post.postType === "recommend" ? "👍 推荐" : post.postType === "avoid" ? "⚠️ 避雷" : ""}
        </div>
        <h3>{post.title}</h3>
        <p>{post.content}</p>
        <div className="meta">
          <div className="author-info">
            <span>{post.author?.nickname || "匿名用户"}</span>
            <span className="level-tag small">{post.author?.level}</span>
          </div>
          <span>
            {post.likeCount} 赞 · {post.commentCount} 评
          </span>
        </div>
        {post.aiVerified === "verified" && <span className="ai-badge mini">✓ AI已验真</span>}
      </div>
    </article>
  );
}

function Tabbar({ view, user, onGo }: { view: View; user: User | null; onGo: (view: View) => void }) {
  return (
    <nav className="tabbar">
      <button className={view === "home" ? "active" : ""} onClick={() => onGo("home")}>
        首页
      </button>
      <button className={view === "map" ? "active" : ""} onClick={() => onGo("map")}>
        地图
      </button>
      <button className={view === "ranking" ? "active" : ""} onClick={() => onGo("ranking")}>
        榜单
      </button>
      <button className={view.startsWith("bounty") ? "active" : ""} onClick={() => onGo("bounty")}>
        悬赏
      </button>
      <button className={view === "publish" ? "active" : ""} onClick={() => onGo(user ? "publish" : "login")}>
        发布
      </button>
      <button className={view === "mine" ? "active" : ""} onClick={() => onGo(user ? "mine" : "login")}>
        我的
      </button>
    </nav>
  );
}

function MapView({
  mapMerchants,
  merchantStarPoints,
  merchantRewards,
  onGo,
  onSelectMerchant,
  onOpenMerchantDetail,
  onSelectRewardMerchant
}: {
  mapMerchants: MapMerchant[];
  merchantStarPoints: Record<string, StarPoints>;
  merchantRewards: Record<string, MerchantReward[]>;
  onGo: (view: View) => void;
  onSelectMerchant: (merchant: MapMerchant) => void;
  onOpenMerchantDetail: (merchant: MapMerchant) => void;
  onSelectRewardMerchant: (merchant: MapMerchant) => void;
}) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const leafletMapRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<MapMerchant | null>(null);

  // 弗雷德广场坐标
  const FREDA_LAT = 30.3186;
  const FREDA_LNG = 120.3425;

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    // 初始化 Leaflet 地图
    const L = (window as any).L;
    if (!L) return;

    // 修复 Leaflet 默认图标在移动端加载失败的问题
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '',
      iconUrl: '',
      shadowUrl: '',
    });

    // 创建地图，以弗雷德广场为中心
    const map = L.map(mapRef.current, {
      center: [FREDA_LAT, FREDA_LNG],
      zoom: 17,
      zoomControl: true
    });

    // 添加 OpenStreetMap 图层
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // 添加弗雷德广场中心标记
    const centerIcon = L.divIcon({
      className: 'custom-center-marker',
      html: '<div class="center-marker"><div class="center-dot"></div><div class="center-pulse"></div></div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([FREDA_LAT, FREDA_LNG], { icon: centerIcon })
      .addTo(map)
      .bindPopup('<div style="text-align:center;font-weight:bold;">🏢 弗雷德广场</div>');

    leafletMapRef.current = map;

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // 当商家数据加载时，添加标记
  useEffect(() => {
    if (!leafletMapRef.current || !mapMerchants.length) return;

    const L = (window as any).L;
    const map = leafletMapRef.current;

    // 清除旧标记
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // 添加商家标记
    mapMerchants.forEach((merchant, index) => {
      // 创建自定义圆形标记
      const starBadge = merchant.hasStarPoints ? '<div class="marker-star-badge">⭐</div>' : '';
      const markerHtml = `
        <div class="map-merchant-marker ${merchant.hasStarPoints ? 'has-starpoints' : ''}" data-type="${merchant.type}">
          <div class="marker-circle"></div>
          <div class="marker-icon">${getIconByType(merchant.type)}</div>
          ${starBadge}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-merchant-marker',
        html: markerHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([merchant.latitude, merchant.longitude], { icon: customIcon })
        .addTo(map);

      // 点击标记显示信息卡片
      marker.on('click', () => {
        setSelectedMerchant(merchant);
        onSelectMerchant(merchant);
      });

      markersRef.current.push(marker);
    });
  }, [mapMerchants]);

  return (
    <>
      <header className="topbar">
        <div>
          <span className="eyebrow">地图</span>
          <h1>弗雷德广场周边</h1>
        </div>
      </header>
      
      <section className="real-map-container">
        <div ref={mapRef} className="leaflet-map" />
        
        {/* 地图图例 */}
        <div className="map-legend">
          <div className="legend-item">
            <span className="legend-dot center"></span>
            <span>弗雷德广场</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot merchant"></span>
            <span>周边商家</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot starpoints"></span>
            <span>⭐ 星享积分商家</span>
          </div>
        </div>
      </section>

      {/* 悬浮信息卡片 */}
      {selectedMerchant && (
        <div className="map-popup-overlay" onClick={() => setSelectedMerchant(null)}>
          <div className="map-popup-card" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={() => setSelectedMerchant(null)}>×</button>
            
            <div className="popup-header">
              <div className="popup-icon">{getIconByType(selectedMerchant.type)}</div>
              <div className="popup-title">
                <h3>{selectedMerchant.name}</h3>
                <span className="popup-type">{selectedMerchant.type}</span>
              </div>
              <div className={`popup-credibility-badge ${selectedMerchant.credibilityLevel}`}>
                可信度 {selectedMerchant.credibilityScore}%
              </div>
            </div>

            <div className="popup-address">
              <span className="address-icon">📍</span>
              <span>{selectedMerchant.address}</span>
            </div>

            {selectedMerchant.tel && (
              <div className="popup-tel">
                <span className="tel-icon">📞</span>
                <span>{selectedMerchant.tel}</span>
              </div>
            )}

            {/* 平台可信度数据 */}
            <div className="popup-credibility-section">
              <div className="credibility-stats">
                <div className="credibility-stat">
                  <span className="stat-value">{selectedMerchant.postCount}</span>
                  <span className="stat-label">食证帖子</span>
                </div>
                <div className="credibility-stat">
                  <span className="stat-value">{selectedMerchant.verifiedPostCount}</span>
                  <span className="stat-label">已验真</span>
                </div>
                <div className="credibility-stat">
                  <span className="stat-value">{selectedMerchant.photos.length}</span>
                  <span className="stat-label">用户照片</span>
                </div>
                <div className="credibility-stat">
                  <span className="stat-value">{selectedMerchant.distance}米</span>
                  <span className="stat-label">距离</span>
                </div>
              </div>
            </div>

            {/* 用户上传的照片 */}
            {selectedMerchant.photos.length > 0 && (
              <div className="popup-photos">
                <h4>用户上传照片</h4>
                <div className="photos-grid">
                  {selectedMerchant.photos.slice(0, 4).map((photo) => (
                    <div key={photo.id} className="photo-thumb">
                      <img src={photo.url} alt="" />
                      <span className="photo-ai-badge" data-status={photo.aiVerified}>
                        {photo.aiVerified === "verified" ? "✓" : "?"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 最新食证评价 */}
            {selectedMerchant.latestPost && (
              <div className="popup-latest-post">
                <h4>最新食证评价</h4>
                <div className="latest-post-card">
                  <img src={selectedMerchant.latestPost.coverImageUrl} alt="" />
                  <div className="latest-post-content">
                    <h5>{selectedMerchant.latestPost.title}</h5>
                    <p>{selectedMerchant.latestPost.content}</p>
                    <div className="latest-post-meta">
                      <span className="ai-badge mini" data-status={selectedMerchant.latestPost.aiVerified}>
                        {selectedMerchant.latestPost.aiVerified === "verified" ? "✓ AI已验真" : "待验真"}
                      </span>
                      <span>👍 {selectedMerchant.latestPost.likeCount}</span>
                      <span>💬 {selectedMerchant.latestPost.commentCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 星享积分入口 */}
            {(() => {
              const starPoints = merchantStarPoints[selectedMerchant.id];
              const rewards = merchantRewards[selectedMerchant.id] || [];
              return starPoints ? (
                <div className="popup-starpoints-section" onClick={(e) => e.stopPropagation()}>
                  <div className="starpoints-header">
                    <div className="starpoints-icon">⭐</div>
                    <div className="starpoints-info">
                      <span className="starpoints-label">商家星享积分</span>
                      <span className={`starpoints-level ${starPoints.level}`}>
                        {starPoints.level === "platinum" ? "💎 铂金会员" : 
                         starPoints.level === "gold" ? "🥇 黄金会员" : 
                         starPoints.level === "silver" ? "🥈 白银会员" : "🥉 青铜会员"}
                      </span>
                    </div>
                    <div className="starpoints-balance">
                      <span className="balance-value">{starPoints.points}</span>
                      <span className="balance-label">积分</span>
                    </div>
                  </div>
                  
                  {rewards.length > 0 && (
                    <div className="starpoints-rewards-preview">
                      <div className="rewards-preview-header">
                        <span>可兑换权益</span>
                        <span className="rewards-count">{rewards.length}个</span>
                      </div>
                      <div className="rewards-preview-list">
                        {rewards.slice(0, 3).map(reward => (
                          <div key={reward.id} className="reward-preview-item">
                            <span className="reward-icon">
                              {reward.type === "coupon" ? "🎫" : 
                               reward.type === "discount" ? "🏷️" : 
                               reward.type === "package" ? "🎁" : "☕"}
                            </span>
                            <span className="reward-title">{reward.title}</span>
                            <span className="reward-cost">{reward.pointsCost}积分</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button 
                    className="starpoints-enter-btn"
                    onClick={() => {
                      const merchant = selectedMerchant;
                      setSelectedMerchant(null);
                      setTimeout(() => {
                        onSelectRewardMerchant(merchant);
                        onGo("starpoints");
                      }, 50);
                    }}
                  >
                    进入积分权益中心 ›
                  </button>
                </div>
              ) : null;
            })()}

            <div className="popup-actions">
              <button className="primary" onClick={() => {
                const merchant = selectedMerchant;
                setSelectedMerchant(null);
                setTimeout(() => onOpenMerchantDetail(merchant), 50);
              }}>
                查看商家详情
              </button>
              <button className="secondary" onClick={() => onGo("publish")}>
                📷 上传照片/评价
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 商家列表 */}
      <section className="merchant-list-section">
        <h2>周边商家 ({mapMerchants.length})</h2>
        {/* 推流提示 */}
        <div className="boost-notice">
          <span className="boost-icon">⭐</span>
          <span>开通星享积分的商家将获得更多推荐曝光</span>
        </div>
        <div className="merchant-scroll-list">
          {mapMerchants.length ? (
            mapMerchants.map((merchant) => (
              <div 
                key={merchant.id} 
                className={`merchant-list-item ${merchant.hasStarPoints ? 'has-starpoints' : ''}`}
                onClick={() => {
                  setSelectedMerchant(merchant);
                  // 地图移动到该商家位置
                  if (leafletMapRef.current) {
                    leafletMapRef.current.setView([merchant.latitude, merchant.longitude], 18);
                  }
                }}
              >
                <span className="merchant-list-icon">{getIconByType(merchant.type)}</span>
                <div className="merchant-list-info">
                  <strong>{merchant.name}</strong>
                  {merchant.hasStarPoints && <span className="starpoints-tag">⭐ 星享积分</span>}
                  <p>{merchant.address}</p>
                  <div className="merchant-list-meta">
                    <span className={`credibility-badge mini ${merchant.credibilityLevel}`}>
                      可信度 {merchant.credibilityScore}%
                    </span>
                    <span className="distance">{merchant.distance}米</span>
                    <span className="post-count">{merchant.postCount}条食证</span>
                  </div>
                </div>
                <span className="merchant-list-arrow">›</span>
              </div>
            ))
          ) : (
            <Empty text="加载中..." />
          )}
        </div>
      </section>
    </>
  );
}

function RankingView({
  rankings,
  rankingTab,
  onTabChange,
  onGo,
  onOpenMerchant
}: {
  rankings: WeeklyRanking[];
  rankingTab: "hot" | "avoid";
  onTabChange: (tab: "hot" | "avoid") => void;
  onGo: (view: View) => void;
  onOpenMerchant: (merchant: Merchant) => void;
}) {
  // 获取避雷等级样式
  function getAvoidLevelStyle(level: "warning" | "danger" | "severe") {
    switch (level) {
      case "severe": return { bg: "#ffebee", color: "#c62828", label: "严重避雷" };
      case "danger": return { bg: "#fff3e0", color: "#e65100", label: "高风险" };
      default: return { bg: "#fff8e1", color: "#f57f17", label: "需注意" };
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <span className="eyebrow">榜单</span>
          <h1>每周排行</h1>
        </div>
      </header>
      
      {/* 榜单说明 */}
      <section className="ranking-intro">
        {rankingTab === "hot" ? (
          <div className="intro-card hot-intro">
            <div className="intro-icon">🔥</div>
            <div className="intro-content">
              <h3>热度榜</h3>
              <p>基于AI算法综合计算：可信度(40%) + 好评率(35%) + 点击率(25%)</p>
            </div>
          </div>
        ) : (
          <div className="intro-card avoid-intro">
            <div className="intro-icon">⚠️</div>
            <div className="intro-content">
              <h3>避雷榜</h3>
              <p>根据用户差评、举报数据及AI分析，提醒消费者谨慎选择</p>
            </div>
          </div>
        )}
      </section>
      
      <section className="tabs ranking-tabs">
        <button 
          className={rankingTab === "hot" ? "active" : ""} 
          onClick={() => onTabChange("hot")}
        >
          🔥 热度榜
        </button>
        <button 
          className={rankingTab === "avoid" ? "active" : ""} 
          onClick={() => onTabChange("avoid")}
        >
          ⚠️ 避雷榜
        </button>
      </section>
      
      <section className="ranking-list">
        {rankings.length ? (
          rankings.map((item, index) => (
            <div 
              key={item.id} 
              className={`ranking-item ${rankingTab === "avoid" ? "avoid-item" : ""}`}
              onClick={item.merchant ? () => onOpenMerchant(item.merchant as Merchant) : undefined}
            >
              {/* 排名数字 */}
              <span className={`rank-number ${rankingTab === "hot" ? `rank-${index + 1}` : `avoid-rank-${item.avoidMetrics?.avoidLevel}`} `}>
                {index + 1}
              </span>
              
              {rankingTab === "hot" && item.hotMetrics && item.merchant && (
                <>
                  <span className="merchant-icon">{item.merchant.mapIcon || "🏪"}</span>
                  <div className="ranking-info">
                    <strong>{item.merchant.businessName}</strong>
                    {/* 热度指标展示 */}
                    <div className="hot-metrics">
                      <div className="metric-item">
                        <span className="metric-label">可信度</span>
                        <span className="metric-value">{item.hotMetrics.credibilityScore}</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">好评率</span>
                        <span className="metric-value">{item.hotMetrics.positiveRate}%</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">周点击</span>
                        <span className="metric-value">{item.hotMetrics.clickRate}</span>
                      </div>
                    </div>
                    {/* AI综合评分 */}
                    <div className="ai-score-bar">
                      <div className="score-fill" style={{ width: `${item.hotMetrics.aiScore}%` }} />
                      <span className="score-text">AI评分: {item.hotMetrics.aiScore}</span>
                    </div>
                  </div>
                  <div className="rank-badge hot">
                    <span className="badge-score">{item.score}</span>
                    <span className="badge-label">综合分</span>
                  </div>
                </>
              )}
              
              {rankingTab === "avoid" && item.avoidMetrics && item.merchant && (
                <>
                  <span className="merchant-icon avoid">{item.merchant.mapIcon || "🏪"}</span>
                  <div className="ranking-info">
                    <strong>{item.merchant.businessName}</strong>
                    {/* 避雷等级 */}
                    <div 
                      className="avoid-level-badge"
                      style={{ 
                        backgroundColor: getAvoidLevelStyle(item.avoidMetrics.avoidLevel).bg,
                        color: getAvoidLevelStyle(item.avoidMetrics.avoidLevel).color
                      }}
                    >
                      {getAvoidLevelStyle(item.avoidMetrics.avoidLevel).label}
                    </div>
                    {/* 避雷原因 */}
                    <div className="avoid-reasons">
                      {item.avoidMetrics.reasons.map((reason, i) => (
                        <span key={i} className="reason-tag">{reason}</span>
                      ))}
                    </div>
                    {/* 最近问题 */}
                    {item.avoidMetrics.lastIncident && (
                      <p className="last-incident">📋 {item.avoidMetrics.lastIncident}</p>
                    )}
                    {/* 统计数据 */}
                    <div className="avoid-stats">
                      <span>👎 差评 {item.avoidMetrics.negativeCount}</span>
                      <span>🚨 举报 {item.avoidMetrics.reportCount}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        ) : (
          <Empty text="暂无排行数据" />
        )}
      </section>
    </>
  );
}

function MerchantDetailView({
  merchant,
  posts,
  bounties,
  photos,
  onGo,
  onOpenPost,
  onOpenBounty,
  user,
  onLoginRequired
}: {
  merchant: Merchant;
  posts: Post[];
  bounties: Bounty[];
  photos: any[];
  onGo: (view: View) => void;
  onOpenPost: (id: string) => void;
  onOpenBounty: (id: string) => void;
  user: User | null;
  onLoginRequired: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"posts" | "bounties" | "photos" | "comments">("posts");
  const [merchantComments, setMerchantComments] = useState<MerchantComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  // 加载商家评论
  async function loadMerchantComments() {
    if (!merchant.id) return;
    setLoadingComments(true);
    try {
      // 尝试从API加载
      const data = await request<{ comments: MerchantComment[] }>(`/merchants/${merchant.id}/comments`, "");
      setMerchantComments(data.comments);
    } catch {
      // 如果没有评论数据，使用模拟数据
      setMerchantComments([]);
    } finally {
      setLoadingComments(false);
    }
  }

  // 切换到评论tab时加载评论
  useEffect(() => {
    if (activeTab === "comments") {
      loadMerchantComments();
    }
  }, [activeTab, merchant.id]);

  // 商家专属评论区组件
  function MerchantCommentsSection() {
    async function handleReply(event: FormEvent<HTMLFormElement>, commentId: string) {
      event.preventDefault();
      if (!replyContent.trim()) return;
      if (!user) {
        onLoginRequired();
        return;
      }
      try {
        // mock模式：直接更新本地评论
        setMerchantComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, reply: replyContent, repliedAt: new Date().toISOString() } : c
        ));
        setReplyContent("");
        setReplyingTo(null);
      } catch (error) {
        console.error("Failed to reply:", error);
      }
    }

    return (
      <section className="merchant-comments-section">
        <div className="comments-header">
          <h3>商家专属评论区</h3>
          <p className="comments-hint">针对该商家的真实食证评价，AI会评判评论真实性</p>
        </div>
        
        {loadingComments ? (
          <Empty text="加载中..." />
        ) : merchantComments.length > 0 ? (
          <div className="comments-list">
            {merchantComments.map((comment) => (
              <div key={comment.id} className="merchant-comment-item">
                <div className="comment-header">
                  <img className="avatar" src={comment.author?.avatarUrl || "https://api.dicebear.com/7.x/initials/svg?seed=user"} alt="" />
                  <div className="comment-meta">
                    <div className="comment-user-row">
                      <strong>{comment.author?.nickname || "匿名用户"}</strong>
                      <span className="ai-badge mini" data-status={comment.aiVerified}>
                        {comment.aiVerified === "verified" ? "✓ 真实" : comment.aiVerified === "fake" ? "⚠️ 水军" : "待验真"}
                      </span>
                    </div>
                    <span className="comment-time">{new Date(comment.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <p className="comment-content">{comment.content}</p>
                {comment.receiptImageUrl && (
                  <img className="comment-receipt" src={comment.receiptImageUrl} alt="" />
                )}
                <div className="comment-footer">
                  <span>消耗 {comment.consumedCoins} 信用币</span>
                  <button className="reply-btn-small" onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}>
                    回复
                  </button>
                </div>
                
                {replyingTo === comment.id && (
                  <form className="reply-form-inline" onSubmit={(e) => handleReply(e, comment.id)}>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="输入您的回复..."
                      rows={2}
                    />
                    <div className="reply-actions">
                      <button type="button" onClick={() => setReplyingTo(null)}>取消</button>
                      <button className="primary" type="submit">发送</button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty text="暂无消费者评论，快来发布第一条吧！" />
        )}
        
        <div className="comment-action-tip">
          <span>📷</span>
          <span>前往「发布」上传食证照片，成为第一个评价者</span>
          <button className="link-btn" onClick={() => onGo("publish")}>去发布</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <button className="back" onClick={() => onGo("home")}>← 返回</button>
      <section className="panel merchant-header">
        <div className="merchant-icon-large">{merchant.mapIcon || "🏪"}</div>
        <h1>{merchant.businessName}</h1>
        <p>{merchant.businessAddress}</p>
        <div className="merchant-status">
          <span className="status-badge approved">已认证</span>
          <span className="ai-badge" data-status={merchant.aiVerified}>
            {merchant.aiVerified === "verified" ? "✓ AI已验真" : "待验真"}
          </span>
        </div>
      </section>
      
      <section className="tabs">
        <button 
          className={activeTab === "posts" ? "active" : ""} 
          onClick={() => setActiveTab("posts")}
        >
          相关帖子 ({posts.length})
        </button>
        <button 
          className={activeTab === "bounties" ? "active" : ""} 
          onClick={() => setActiveTab("bounties")}
        >
          悬赏记录 ({bounties.length})
        </button>
        <button 
          className={activeTab === "photos" ? "active" : ""} 
          onClick={() => setActiveTab("photos")}
        >
          商家照片 ({photos.length})
        </button>
        <button 
          className={activeTab === "comments" ? "active" : ""} 
          onClick={() => setActiveTab("comments")}
        >
          商家评论
        </button>
      </section>
      
      {activeTab === "posts" && (
        <section className="feed">
          {posts.length ? (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onOpenPost={onOpenPost} />
            ))
          ) : (
            <Empty text="暂无相关帖子" />
          )}
        </section>
      )}
      
      {activeTab === "bounties" && (
        <section className="feed">
          {bounties.length ? (
            bounties.map((bounty) => (
              <div 
                key={bounty.id} 
                className="bounty-card" 
                onClick={() => onOpenBounty(bounty.id)}
              >
                <div className="bounty-header">
                  <div className="bounty-merchant">
                    <h3>{bounty.merchantName}</h3>
                    <p>{bounty.merchantAddress}</p>
                  </div>
                  <div className="bounty-reward">
                    <span className="reward-amount">{bounty.rewardCoins}</span>
                    <span className="reward-label">信用币</span>
                  </div>
                </div>
                <p className="bounty-desc">{bounty.description}</p>
                <div className="bounty-footer">
                  <span className={`status-tag ${bounty.status}`}>
                    {bounty.status === "active" ? "可接取" : bounty.status === "accepted" ? "进行中" : bounty.status === "completed" ? "已完成" : "已失败"}
                  </span>
                  <span>{new Date(bounty.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          ) : (
            <Empty text="暂无悬赏记录" />
          )}
        </section>
      )}
      
      {activeTab === "photos" && (
        <section className="photo-gallery">
          {photos.length ? (
            photos.map((photo) => (
              <div key={photo.id} className="photo-item">
                <img src={photo.url} alt="" />
                <span className="ai-badge mini" data-status={photo.aiVerified}>
                  {photo.aiVerified === "verified" ? "✓ 已验真" : "待验真"}
                </span>
              </div>
            ))
          ) : (
            <Empty text="暂无商家照片" />
          )}
        </section>
      )}
      
      {activeTab === "comments" && <MerchantCommentsSection />}
    </>
  );
}

// 商家星享积分权益中心页面
function StarPointsView({
  merchant,
  starPoints,
  rewards,
  onGo,
  onClaimReward,
  user
}: {
  merchant: MapMerchant;
  starPoints: StarPoints | undefined;
  rewards: MerchantReward[];
  onGo: (view: View) => void;
  onClaimReward: (reward: MerchantReward) => void;
  user: User | null;
}) {
  const [activeTab, setActiveTab] = useState<"earn" | "rewards" | "myrewards">("earn");
  const [selectedReward, setSelectedReward] = useState<MerchantReward | null>(null);

  // 计算等级进度
  const levelProgress = starPoints ? (starPoints.points / starPoints.nextLevelPoints) * 100 : 0;

  // 获取等级颜色
  function getLevelColor(level: string) {
    switch (level) {
      case "platinum": return "#9c27b0";
      case "gold": return "#ffc107";
      case "silver": return "#9e9e9e";
      default: return "#cd7f32";
    }
  }

  // 获取等级名称
  function getLevelName(level: string) {
    switch (level) {
      case "platinum": return "💎 铂金会员";
      case "gold": return "🥇 黄金会员";
      case "silver": return "🥈 白银会员";
      default: return "🥉 青铜会员";
    }
  }

  // 积分获取方式数据
  const earnWays = [
    { icon: "🛒", title: "消费打卡", desc: "到店消费并上传凭证", points: "50-200", color: "#ff6b6b" },
    { icon: "📝", title: "发布食证", desc: "发布商家相关帖子", points: "30-100", color: "#4ecdc4" },
    { icon: "👀", title: "浏览互动", desc: "浏览商家页面、点赞评论", points: "5-20", color: "#45b7d1" },
    { icon: "👥", title: "邀请好友", desc: "邀请好友关注商家", points: "20/人", color: "#96ceb4" },
    { icon: "📍", title: "签到打卡", desc: "每日到店签到", points: "10", color: "#ffeaa7" },
    { icon: "💬", title: "真实评论", desc: "发布真实消费评论", points: "15-50", color: "#dfe6e9" },
  ];

  return (
    <>
      <button className="back" onClick={() => onGo("map")}>← 返回地图</button>
      
      {/* 星享积分头部卡片 - 突出展示当前积分 */}
      <section className="panel starpoints-hero">
        <div className="merchant-info-header">
          <span className="merchant-icon-large">{getIconByType(merchant.type)}</span>
          <div>
            <h1>{merchant.name}</h1>
            <p className="starpoints-subtitle">星享积分权益中心</p>
          </div>
        </div>
        
        {starPoints ? (
          <div className="starpoints-card">
            <div className="starpoints-main">
              <div className="starpoints-balance-large">
                <span className="balance-number">{starPoints.points}</span>
                <span className="balance-unit">我的积分</span>
              </div>
              <div 
                className="member-level-badge"
                style={{ backgroundColor: getLevelColor(starPoints.level) }}
              >
                {getLevelName(starPoints.level)}
              </div>
            </div>
            
            {/* 等级进度条 */}
            <div className="level-progress-section">
              <div className="level-progress-bar">
                <div 
                  className="level-progress-fill"
                  style={{ width: `${Math.min(levelProgress, 100)}%`, backgroundColor: getLevelColor(starPoints.level) }}
                />
              </div>
              <div className="level-progress-text">
                <span>再积 {starPoints.nextLevelPoints - starPoints.points} 分升级</span>
                <span>累计获得 {starPoints.totalEarned} 分</span>
              </div>
            </div>
            
            {/* 快速统计 */}
            <div className="starpoints-stats">
              <div className="stat-item">
                <span className="stat-value">{rewards.length}</span>
                <span className="stat-label">可兑换权益</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{merchant.postCount}</span>
                <span className="stat-label">食证帖</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{merchant.distance}m</span>
                <span className="stat-label">距离</span>
              </div>
            </div>
          </div>
        ) : (
          <Empty text="加载积分数据中..." />
        )}
      </section>
      
      {/* 标签页 - 默认展示"如何获积分" */}
      <section className="tabs starpoints-tabs">
        <button 
          className={activeTab === "earn" ? "active" : ""} 
          onClick={() => setActiveTab("earn")}
        >
          🌟 如何获积分
        </button>
        <button 
          className={activeTab === "rewards" ? "active" : ""} 
          onClick={() => setActiveTab("rewards")}
        >
          🎁 可兑换 ({rewards.length})
        </button>
        <button 
          className={activeTab === "myrewards" ? "active" : ""} 
          onClick={() => setActiveTab("myrewards")}
        >
          🎫 我的权益
        </button>
      </section>
      
      {/* 如何获得积分 - 默认展示 */}
      {activeTab === "earn" && (
        <section className="earn-ways-section">
          <div className="earn-ways-grid">
            {earnWays.map((way, idx) => (
              <div key={idx} className="earn-way-card" style={{ borderLeftColor: way.color }}>
                <span className="earn-way-icon">{way.icon}</span>
                <div className="earn-way-info">
                  <h4>{way.title}</h4>
                  <p>{way.desc}</p>
                </div>
                <div className="earn-way-points">
                  <span className="points-value">+{way.points}</span>
                  <span className="points-label">积分</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* 会员等级说明 */}
          <div className="rules-card level-rules-card">
            <h3>👑 会员等级与特权</h3>
            <div className="level-list">
              <div className="level-item">
                <span className="level-badge bronze">🥉 青铜</span>
                <span>0-499分 · 基础权益</span>
              </div>
              <div className="level-item">
                <span className="level-badge silver">🥈 白银</span>
                <span>500-999分 · 9.5折特权</span>
              </div>
              <div className="level-item">
                <span className="level-badge gold">🥇 黄金</span>
                <span>1000-1999分 · 9折+专属礼包</span>
              </div>
              <div className="level-item">
                <span className="level-badge platinum">💎 铂金</span>
                <span>2000分+ · 8.5折+VIP特权</span>
              </div>
            </div>
          </div>

          {/* 使用须知 */}
          <div className="rules-card">
            <h3>⚠️ 使用须知</h3>
            <ul>
              <li>积分仅限在当前商家使用，不可跨店通用</li>
              <li>兑换的权益有效期为30天，过期自动失效</li>
              <li>权益不可与其他优惠叠加使用</li>
              <li>最终解释权归商家所有</li>
            </ul>
          </div>
        </section>
      )}
      
      {/* 可兑换权益 */}
      {activeTab === "rewards" && (
        <section className="rewards-list">
          {rewards.length > 0 ? (
            rewards.map(reward => (
              <div key={reward.id} className="reward-card">
                <div className="reward-image">
                  <img src={reward.imageUrl} alt="" />
                  <span className="reward-type-badge">
                    {reward.type === "coupon" ? "优惠券" : 
                     reward.type === "discount" ? "折扣" : 
                     reward.type === "package" ? "套餐" : "赠品"}
                  </span>
                </div>
                <div className="reward-content">
                  <h3>{reward.title}</h3>
                  <p className="reward-desc">{reward.description}</p>
                  {reward.originalPrice && (
                    <p className="reward-original">原价 ¥{reward.originalPrice}</p>
                  )}
                  <div className="reward-footer">
                    <div className="reward-cost">
                      <span className="cost-points">{reward.pointsCost}</span>
                      <span className="cost-label">积分</span>
                    </div>
                    <div className="reward-stock">
                      剩余 {reward.stock} 份
                    </div>
                  </div>
                </div>
                <button 
                  className={`claim-btn ${!starPoints || starPoints.points < reward.pointsCost ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!user) {
                      onGo("login");
                      return;
                    }
                    if (starPoints && starPoints.points >= reward.pointsCost) {
                      setSelectedReward(reward);
                    }
                  }}
                  disabled={!starPoints || starPoints.points < reward.pointsCost}
                >
                  {starPoints && starPoints.points >= reward.pointsCost ? '立即兑换' : '积分不足'}
                </button>
              </div>
            ))
          ) : (
            <Empty text="暂无可用权益" />
          )}
        </section>
      )}
      
      {/* 我的权益 */}
      {activeTab === "myrewards" && (
        <section className="my-rewards-section">
          {!user ? (
            <div className="login-prompt">
              <p>登录后查看您的权益</p>
              <button className="primary" onClick={() => onGo("login")}>去登录</button>
            </div>
          ) : (
            <Empty text="您还没有兑换任何权益" />
          )}
        </section>
      )}
      
      {/* 兑换确认弹窗 */}
      {selectedReward && (
        <div className="modal-overlay" onClick={() => setSelectedReward(null)}>
          <div className="modal-content claim-modal" onClick={e => e.stopPropagation()}>
            <h3>确认兑换</h3>
            <div className="claim-reward-info">
              <img src={selectedReward.imageUrl} alt="" />
              <div>
                <h4>{selectedReward.title}</h4>
                <p>{selectedReward.description}</p>
              </div>
            </div>
            <div className="claim-cost-info">
              <span>消耗积分：</span>
              <span className="cost-value">{selectedReward.pointsCost}</span>
              <span>剩余积分：{starPoints?.points || 0}</span>
            </div>
            <div className="modal-actions">
              <button onClick={() => setSelectedReward(null)}>取消</button>
              <button 
                className="primary"
                onClick={() => {
                  onClaimReward(selectedReward);
                  setSelectedReward(null);
                }}
              >
                确认兑换
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 商家自传图管理页面
function MerchantPhotosView({
  photos,
  onGo,
  onUploadPhoto,
  onDeletePhoto,
  imageDataUrl,
  onPickImage
}: {
  photos: MerchantPhoto[];
  onGo: (view: View) => void;
  onUploadPhoto: (dataUrl: string, photoType: string) => void;
  onDeletePhoto: (photoId: string) => void;
  imageDataUrl: string;
  onPickImage: (file: File | undefined) => void;
}) {
  const [uploadType, setUploadType] = useState("dish");
  const [showUpload, setShowUpload] = useState(false);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageDataUrl) return;
    await onUploadPhoto(imageDataUrl, uploadType);
    setShowUpload(false);
  }

  return (
    <>
      <button className="back" onClick={() => onGo("merchant")}>← 返回商家中心</button>
      <section className="panel">
        <div className="section-header">
          <h1>商家自传图管理</h1>
          <button className="primary small" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? "取消上传" : "上传图片"}
          </button>
        </div>
        
        {showUpload && (
          <form className="form" onSubmit={handleUpload}>
            <label>
              图片类型
              <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                <option value="dish">菜品图</option>
                <option value="environment">环境图</option>
                <option value="kitchen">后厨图</option>
                <option value="activity">活动图</option>
              </select>
            </label>
            <label>
              选择图片
              <input type="file" accept="image/*" onChange={(e) => onPickImage(e.target.files?.[0])} />
            </label>
            {imageDataUrl ? <img className="preview" src={imageDataUrl} alt="" /> : null}
            <button className="primary" type="submit" disabled={!imageDataUrl}>
              确认上传
            </button>
          </form>
        )}
      </section>
      
      <section className="photo-gallery">
        {photos.length ? (
          photos.map((photo) => (
            <div key={photo.id} className="photo-item with-actions">
              <img src={photo.url} alt="" />
              <div className="photo-info">
                <span className="photo-type">{photo.photoType === "dish" ? "菜品图" : photo.photoType === "environment" ? "环境图" : photo.photoType === "kitchen" ? "后厨图" : "活动图"}</span>
                <span className="ai-badge mini" data-status={photo.aiVerified}>
                  {photo.aiVerified === "verified" ? "✓ 已验真" : photo.aiVerified === "fake" ? "✗ 疑似虚假" : "待验真"}
                </span>
              </div>
              <button className="danger small" onClick={() => onDeletePhoto(photo.id)}>删除</button>
            </div>
          ))
        ) : (
          <Empty text="暂无上传图片" />
        )}
      </section>
    </>
  );
}

// 商家优惠券管理页面
function MerchantCouponsView({
  coupons,
  onGo,
  onUploadCoupon,
  onDeleteCoupon,
  imageDataUrl,
  onPickImage
}: {
  coupons: Coupon[];
  onGo: (view: View) => void;
  onUploadCoupon: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteCoupon: (couponId: string) => void;
  imageDataUrl: string;
  onPickImage: (file: File | undefined) => void;
}) {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      <button className="back" onClick={() => onGo("merchant")}>← 返回商家中心</button>
      <section className="panel">
        <div className="section-header">
          <h1>优惠券管理</h1>
          <button className="primary small" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? "取消创建" : "创建优惠券"}
          </button>
        </div>
        
        {showUpload && (
          <form className="form" onSubmit={onUploadCoupon}>
            <label>
              优惠券名称
              <input name="title" required placeholder="例如：满100减20优惠券" />
            </label>
            <label>
              优惠券描述
              <textarea name="description" required placeholder="优惠券使用说明..." rows={2} />
            </label>
            <label>
              类型
              <select name="type" defaultValue="coupon">
                <option value="coupon">优惠券</option>
                <option value="discount">折扣券</option>
                <option value="package">套餐券</option>
                <option value="gift">赠品券</option>
              </select>
            </label>
            <label>
              兑换积分
              <input name="pointsCost" type="number" defaultValue="50" min="1" required />
            </label>
            <label>
              原价（选填）
              <input name="originalPrice" type="number" placeholder="例如：128" />
            </label>
            <label>
              折扣值（选填，例如：0.88表示88折）
              <input name="discountValue" type="number" step="0.01" placeholder="例如：0.88" />
            </label>
            <label>
              有效期天数
              <input name="validityDays" type="number" defaultValue="30" min="1" />
            </label>
            <label>
              库存数量
              <input name="stock" type="number" defaultValue="100" min="1" />
            </label>
            <label>
              使用条款（选填）
              <textarea name="terms" placeholder="使用规则说明..." rows={2} />
            </label>
            <label>
              优惠券图片（选填）
              <input type="file" accept="image/*" onChange={(e) => onPickImage(e.target.files?.[0])} />
            </label>
            {imageDataUrl ? <img className="preview" src={imageDataUrl} alt="" /> : null}
            <button className="primary" type="submit">
              创建优惠券
            </button>
          </form>
        )}
      </section>
      
      <section className="coupon-list">
        <h2>我的优惠券</h2>
        {coupons.length > 0 ? (
          coupons.map(coupon => (
            <div key={coupon.id} className="coupon-card">
              <div className="coupon-image">
                {coupon.imageUrl ? (
                  <img src={coupon.imageUrl} alt="" />
                ) : (
                  <div className="coupon-placeholder">
                    {coupon.type === "coupon" ? "🎫" : coupon.type === "discount" ? "🏷️" : coupon.type === "package" ? "🍽️" : "🎁"}
                  </div>
                )}
              </div>
              <div className="coupon-content">
                <h3>{coupon.title}</h3>
                <p>{coupon.description}</p>
                <div className="coupon-meta">
                  <span className="coupon-points">{coupon.pointsCost}积分</span>
                  <span className="coupon-stock">库存: {coupon.stock}</span>
                  <span className="coupon-validity">有效期: {coupon.validityDays}天</span>
                </div>
                {coupon.originalPrice && (
                  <p className="coupon-original">原价: ¥{coupon.originalPrice}</p>
                )}
                {coupon.discountValue && (
                  <p className="coupon-discount">{coupon.discountValue * 10}折</p>
                )}
              </div>
              <button className="danger small" onClick={() => onDeleteCoupon(coupon.id)}>删除</button>
            </div>
          ))
        ) : (
          <Empty text="暂无优惠券，创建一个吧" />
        )}
      </section>
    </>
  );
}

// 消费者评论管理页面
function MerchantCommentsView({
  comments,
  onGo,
  onReplyComment
}: {
  comments: MerchantComment[];
  onGo: (view: View) => void;
  onReplyComment: (commentId: string, content: string) => void;
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  async function handleReply(event: FormEvent<HTMLFormElement>, commentId: string) {
    event.preventDefault();
    if (!replyContent.trim()) return;
    await onReplyComment(commentId, replyContent);
    setReplyingTo(null);
    setReplyContent("");
  }

  return (
    <>
      <button className="back" onClick={() => onGo("merchant")}>← 返回商家中心</button>
      <section className="panel">
        <h1>消费者评论管理</h1>
        <p className="hint">查看和回复用户对您商家的评论。AI会评判评论是否真实。</p>
      </section>
      
      <section className="comments-list">
        {comments.length ? (
          comments.map((comment) => (
            <div key={comment.id} className="merchant-comment-card">
              <div className="comment-header">
                <img className="avatar small" src={comment.author?.avatarUrl} alt="" />
                <div className="comment-meta">
                  <strong>{comment.author?.nickname || "匿名用户"}</strong>
                  <span className="level-tag small">{comment.author?.level}</span>
                </div>
                <span className="ai-badge mini" data-status={comment.aiVerified}>
                  {comment.aiVerified === "verified" ? "✓ 真实" : comment.aiVerified === "fake" ? "⚠️ 水军" : "待验真"}
                </span>
              </div>
              <p className="comment-post-title">评论于: {comment.postTitle}</p>
              <p className="comment-content">{comment.content}</p>
              <div className="comment-footer">
                <span className="comment-time">{new Date(comment.createdAt).toLocaleString()}</span>
                {comment.consumedCoins > 0 && <span className="coins-info">消耗 {comment.consumedCoins} 信用币</span>}
              </div>
              
              {replyingTo === comment.id ? (
                <form className="reply-form" onSubmit={(e) => handleReply(e, comment.id)}>
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="输入您的回复..."
                    rows={3}
                  />
                  <div className="reply-actions">
                    <button type="button" onClick={() => setReplyingTo(null)}>取消</button>
                    <button className="primary" type="submit">发送回复</button>
                  </div>
                </form>
              ) : (
                <button className="reply-btn" onClick={() => setReplyingTo(comment.id)}>
                  回复
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty text="暂无消费者评论" />
        )}
      </section>
    </>
  );
}

// 被悬赏记录页面
function MerchantBountiesView({
  bounties,
  onGo,
  onOpenBounty
}: {
  bounties: Bounty[];
  onGo: (view: View) => void;
  onOpenBounty: (id: string) => void;
}) {
  return (
    <>
      <button className="back" onClick={() => onGo("merchant")}>← 返回商家中心</button>
      <section className="panel">
        <h1>被悬赏记录</h1>
        <p className="hint">查看用户针对您商家发布的悬赏任务</p>
      </section>
      
      <section className="feed">
        {bounties.length ? (
          bounties.map((bounty) => (
            <div 
              key={bounty.id} 
              className="bounty-card merchant-bounty"
              onClick={() => onOpenBounty(bounty.id)}
            >
              <div className="bounty-header">
                <div className="bounty-merchant">
                  <h3>{bounty.merchantName}</h3>
                  <p>{bounty.merchantAddress}</p>
                </div>
                <div className="bounty-reward">
                  <span className="reward-amount">{bounty.rewardCoins}</span>
                  <span className="reward-label">悬赏金额</span>
                </div>
              </div>
              <p className="bounty-desc">{bounty.description}</p>
              <div className="bounty-footer">
                <span className={`status-tag ${bounty.status}`}>
                  {bounty.status === "active" ? "🔓 可接取" : bounty.status === "accepted" ? "🔄 进行中" : bounty.status === "completed" ? "✓ 已完成" : "✗ 已失败"}
                </span>
                <span>发布于 {new Date(bounty.createdAt).toLocaleDateString()}</span>
              </div>
              {bounty.acceptor && (
                <div className="acceptor-info">
                  <span>接取者: {bounty.acceptor.nickname}</span>
                  <img className="avatar mini" src={bounty.acceptor.avatarUrl} alt="" />
                </div>
              )}
              <div className="ai-badge" data-status={bounty.aiVerified}>
                AI验真: {bounty.aiVerified === "verified" ? "✓ 通过" : bounty.aiVerified === "fake" ? "✗ 未通过" : "待验真"}
              </div>
            </div>
          ))
        ) : (
          <Empty text="暂无悬赏记录" />
        )}
      </section>
    </>
  );
}

function Empty({ text = "还没有匹配内容" }: { text?: string }) {
  return <div className="empty">{text}</div>;
}

createRoot(document.querySelector("#app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
