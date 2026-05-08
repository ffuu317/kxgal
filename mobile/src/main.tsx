import React, { FormEvent, useEffect, useMemo, useState } from "react";
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
  merchantName: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  status: string;
  aiVerified: string;
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
  consumedCoins: number;
  receiptImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author?: User | null;
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
};

type View = "home" | "detail" | "publish" | "mine" | "login" | "register" | "bounty" | "bounty-publish" | "bounty-detail" | "credit" | "merchant" | "merchant-apply";

const apiBase = "/api";

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...((options.headers || {}) as Record<string, string>)
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
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

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("eattruth.token") || "");
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [view, setView] = useState<View>("home");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [query, setQuery] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [receiptDataUrl, setReceiptDataUrl] = useState("");
  const [message, setMessage] = useState("");

  const myPosts = useMemo(() => posts.filter((post) => post.authorId === user?.id), [posts, user]);
  const myBounties = useMemo(() => bounties.filter((b) => b.publisherId === user?.id || b.acceptorId === user?.id), [bounties, user]);

  async function api<T>(path: string, options: RequestInit = {}) {
    return request<T>(path, token, options);
  }

  function flash(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage((current) => (current === nextMessage ? "" : current)), 2200);
  }

  async function loadPosts(nextQuery = query) {
    const path = nextQuery ? `/posts?q=${encodeURIComponent(nextQuery)}` : "/posts";
    const data = await api<{ posts: Post[] }>(path);
    setPosts(data.posts);
  }

  async function loadBounties() {
    const data = await api<{ bounties: Bounty[] }>("/bounties");
    setBounties(data.bounties);
  }

  async function loadMyBounties() {
    try {
      const data = await api<{ bounties: Bounty[] }>("/users/me/bounties");
      setBounties(data.bounties);
    } catch (error) {
      console.error("Failed to load my bounties:", error);
    }
  }

  async function loadTransactions() {
    const data = await api<{ transactions: Transaction[] }>("/users/me/transactions");
    setTransactions(data.transactions);
  }

  async function openPost(id: string) {
    const [postData, commentData] = await Promise.all([
      api<{ post: Post }>(`/posts/${id}`),
      api<{ comments: Comment[] }>(`/posts/${id}/comments`)
    ]);
    setSelectedPost(postData.post);
    setComments(commentData.comments);
    setView("detail");
  }

  async function openBounty(id: string) {
    try {
      const data = await api<{ bounty: Bounty }>(`/bounties/${id}`);
      setSelectedBounty(data.bounty);
      setView("bounty-detail");
      await loadMyBounties();
    } catch (error) {
      flash("无法加载悬赏任务详情");
    }
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
    try {
      const path = type === "login" ? "/auth/login" : "/auth/register";
      const data = await request<{ token: string; user: User; loginReward?: boolean }>(path, "", {
        method: "POST",
        body: JSON.stringify(formValues(event.currentTarget))
      });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("eattruth.token", data.token);
      setView("home");
      flash(type === "login" ? (data.loginReward ? "登录成功，获得5信用币" : "登录成功") : "注册成功");
    } catch (error) {
      flash((error as Error).message);
    }
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
      const avatarUrl = await uploadImage(dataUrl, "avatar");
      const data = await api<{ user: User }>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl })
      });
      setUser(data.user);
      flash("头像已更新");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const data = await api<{ user: User }>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(formValues(event.currentTarget))
      });
      setUser(data.user);
      flash("资料已更新");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return setView("login");
    try {
      if (!imageDataUrl) throw new Error("请先选择一张图片");
      const values = formValues(event.currentTarget);
      const imageUrl = await uploadImage(imageDataUrl, "post-image");
      const data = await api<{ post: Post }>("/posts", {
        method: "POST",
        body: JSON.stringify({
          title: values.title,
          content: values.content,
          merchantName: values.merchantName,
          tags: String(values.tags || "")
            .split(/[，,\s]+/)
            .filter(Boolean),
          imageUrls: [imageUrl]
        })
      });
      setImageDataUrl("");
      await loadPosts();
      await openPost(data.post.id);
      flash("发布成功");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function toggleLike(post: Post) {
    if (!user) return setView("login");
    try {
      const data = await api<{ post: Post }>(`/posts/${post.id}/like`, {
        method: post.likedByMe ? "DELETE" : "POST",
        body: "{}"
      });
      setPosts((items) => items.map((item) => (item.id === data.post.id ? data.post : item)));
      if (selectedPost?.id === data.post.id) setSelectedPost(data.post);
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return setView("login");
    if (!selectedPost) return;
    try {
      const values = formValues(event.currentTarget);
      let receiptImageUrl: string | undefined;
      
      if (user.level === "L1" && receiptDataUrl) {
        receiptImageUrl = await uploadImage(receiptDataUrl, "receipt");
      }
      
      await api(`/posts/${selectedPost.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: values.content, receiptImageUrl })
      });
      setReceiptDataUrl("");
      await openPost(selectedPost.id);
      flash("评论已发布");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function deleteComment(id: string) {
    if (!selectedPost) return;
    try {
      await api(`/comments/${id}`, { method: "DELETE", body: "{}" });
      await openPost(selectedPost.id);
      flash("评论已删除");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function deletePost(id: string) {
    try {
      await api(`/posts/${id}`, { method: "DELETE", body: "{}" });
      await loadPosts();
      setView("home");
      flash("帖子已删除");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function publishBounty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return setView("login");
    try {
      const values = formValues(event.currentTarget);
      const rewardCoins = parseInt(values.rewardCoins) || 50;
      const deadlineDays = parseInt(values.deadlineDays) || 7;
      
      await api("/bounties", {
        method: "POST",
        body: JSON.stringify({
          merchantName: values.merchantName,
          merchantAddress: values.merchantAddress,
          description: values.description,
          rewardCoins,
          deadlineDays
        })
      });
      
      await loadBounties();
      setView("bounty");
      flash("悬赏发布成功");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function acceptBounty(bountyId: string) {
    if (!user) return setView("login");
    try {
      await api(`/bounties/${bountyId}/accept`, { method: "POST", body: "{}" });
      await loadMyBounties();
      flash("已接取任务，请到详情页上传图片完成悬赏");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function submitBounty(event: FormEvent<HTMLFormElement>, bountyId: string) {
    event.preventDefault();
    if (!user || !imageDataUrl) {
      flash("请先上传图片");
      return;
    }
    try {
      const imageUrl = await uploadImage(imageDataUrl, "post-image");
      const data = await api<{ success: boolean; reward: number }>(`/bounties/${bountyId}/submit`, {
        method: "POST",
        body: JSON.stringify({ imageUrls: [imageUrl] })
      });
      setImageDataUrl("");
      await loadMyBounties();
      flash(data.success ? `任务完成，获得${data.reward}信用币` : "图片检测未通过，任务失败");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function applyMerchant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return setView("login");
    try {
      const values = formValues(event.currentTarget);
      await api("/users/me/merchant-apply", {
        method: "POST",
        body: JSON.stringify({
          businessName: values.businessName,
          businessAddress: values.businessAddress,
          businessLicense: values.businessLicense || "",
          licenseImageUrl: ""
        })
      });
      const data = await api<{ user: User }>("/users/me");
      setUser(data.user);
      setView("merchant");
      flash("商家认证申请已提交");
    } catch (error) {
      flash((error as Error).message);
    }
  }

  async function uploadKitchenImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !imageDataUrl) {
      flash("请先上传图片");
      return;
    }
    try {
      const imageUrl = await uploadImage(imageDataUrl, "post-image");
      const data = await api<{ success: boolean; message: string }>("/merchant/kitchen-upload", {
        method: "POST",
        body: JSON.stringify({ imageUrls: [imageUrl] })
      });
      setImageDataUrl("");
      const userData = await api<{ user: User }>("/users/me");
      setUser(userData.user);
      flash(data.message);
    } catch (error) {
      flash((error as Error).message);
    }
  }

  useEffect(() => {
    loadPosts().catch((error) => flash((error as Error).message));
    loadBounties().catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    api<{ user: User }>("/users/me")
      .then((data) => setUser(data.user))
      .catch(() => logout(false));
  }, [token]);

  useEffect(() => {
    if (view === "credit" && user) {
      loadTransactions().catch(() => {});
    }
  }, [view, user]);

  useEffect(() => {
    if (view === "mine" && token) {
      loadMyBounties().catch(() => {});
    }
  }, [view, token]);

  return (
    <main className="phone">
      {message ? <div className="toast">{message}</div> : null}
      
      {view === "home" ? (
        <HomeView
          user={user}
          query={query}
          posts={posts}
          onSearch={handleSearch}
          onGo={setView}
          onOpenPost={openPost}
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
        />
      ) : null}
      
      {view === "publish" ? (
        <PublishView
          imageDataUrl={imageDataUrl}
          onPickImage={async (file) => setImageDataUrl(file ? await readFileAsDataUrl(file) : "")}
          onCreatePost={createPost}
        />
      ) : null}
      
      {view === "mine" ? (
        <MineView
          user={user}
          posts={myPosts}
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
        <BountyPublishView onCreateBounty={publishBounty} onGo={setView} />
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
          onGo={setView}
          imageDataUrl={imageDataUrl}
          onPickImage={async (file) => setImageDataUrl(file ? await readFileAsDataUrl(file) : "")}
          onUploadKitchen={uploadKitchenImage}
        />
      ) : null}
      
      {view === "merchant-apply" ? (
        <MerchantApplyView onApply={applyMerchant} onGo={setView} />
      ) : null}
      
      <Tabbar view={view} user={user} onGo={setView} />
    </main>
  );
}

function HomeView({
  user,
  query,
  posts,
  onSearch,
  onGo,
  onOpenPost
}: {
  user: User | null;
  query: string;
  posts: Post[];
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onGo: (view: View) => void;
  onOpenPost: (id: string) => void;
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
      <section className="feed">
        {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} onOpenPost={onOpenPost} />) : <Empty />}
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
  onPickReceipt
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
              <p>{post.merchantName || "未关联商家"}</p>
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
  onCreatePost
}: {
  imageDataUrl: string;
  onPickImage: (file: File | undefined) => void;
  onCreatePost: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="panel">
      <h1>发布帖子</h1>
      <form className="form" onSubmit={onCreatePost}>
        <label>
          图片
          <input type="file" accept="image/*" onChange={(event) => onPickImage(event.currentTarget.files?.[0])} />
        </label>
        {imageDataUrl ? <img className="preview" src={imageDataUrl} alt="" /> : null}
        <label>
          标题
          <input name="title" required />
        </label>
        <label>
          正文
          <textarea name="content" required />
        </label>
        <label>
          商家名称
          <input name="merchantName" />
        </label>
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
  onGo
}: {
  onCreateBounty: (event: FormEvent<HTMLFormElement>) => void;
  onGo: (view: View) => void;
}) {
  return (
    <section className="panel">
      <button className="back" onClick={() => onGo("bounty")}>← 返回</button>
      <h1>发布悬赏</h1>
      <form className="form" onSubmit={onCreateBounty}>
        <label>
          商家名称
          <input name="merchantName" required />
        </label>
        <label>
          商家地址
          <input name="merchantAddress" required />
        </label>
        <label>
          任务描述
          <textarea name="description" required />
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
        
        {canSubmit && (
          <div className="submit-section">
            <h2>提交任务</h2>
            <form className="form" onSubmit={(e) => onSubmit(e, bounty.id)}>
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
  onGo,
  imageDataUrl,
  onPickImage,
  onUploadKitchen
}: {
  user: User | null;
  onGo: (view: View) => void;
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
          <h2>商家专属功能</h2>
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">📷</span>
              <span>商家自传图管理</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💬</span>
              <span>消费者评论管理</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💰</span>
              <span>被悬赏记录</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function MerchantApplyView({
  onApply,
  onGo
}: {
  onApply: (event: FormEvent<HTMLFormElement>) => void;
  onGo: (view: View) => void;
}) {
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

function PostCard({ post, onOpenPost }: { post: Post; onOpenPost: (id: string) => void }) {
  return (
    <article className="post-card" onClick={() => onOpenPost(post.id)}>
      <img className="post-cover" src={post.coverImageUrl} alt="" />
      <div className="post-body">
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

function Empty({ text = "还没有匹配内容" }: { text?: string }) {
  return <div className="empty">{text}</div>;
}

createRoot(document.querySelector("#app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
