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
  createdAt: string;
  updatedAt: string;
  author?: User | null;
};

type View = "home" | "detail" | "publish" | "mine" | "login" | "register";

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
  const [view, setView] = useState<View>("home");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [query, setQuery] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [message, setMessage] = useState("");

  const myPosts = useMemo(() => posts.filter((post) => post.authorId === user?.id), [posts, user]);

  async function api<T>(path: string, options: RequestInit = {}) {
    return request<T>(path, token, options);
  }

  function flash(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage((current) => (current === nextMessage ? "" : current)), 2200);
  }

  async function loadPosts(nextQuery = query) {
    const path = nextQuery ? `/posts/search?q=${encodeURIComponent(nextQuery)}` : "/posts";
    const data = await api<{ posts: Post[] }>(path);
    setPosts(data.posts);
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

  async function uploadImage(dataUrl: string, purpose: "avatar" | "post-image") {
    const path = purpose === "avatar" ? "/files/avatar" : "/files/post-image";
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
      const data = await request<{ token: string; user: User }>(path, "", {
        method: "POST",
        body: JSON.stringify(formValues(event.currentTarget))
      });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("eattruth.token", data.token);
      setView("home");
      flash(type === "login" ? "登录成功" : "注册成功");
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
      await api(`/posts/${selectedPost.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: formValues(event.currentTarget).content })
      });
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

  useEffect(() => {
    loadPosts().catch((error) => flash((error as Error).message));
  }, []);

  useEffect(() => {
    if (!token) return;
    api<{ user: User }>("/users/me")
      .then((data) => setUser(data.user))
      .catch(() => logout(false));
  }, [token]);

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
          onGo={setView}
          onOpenPost={openPost}
          onAvatar={handleAvatar}
          onProfile={handleProfile}
          onLogout={logout}
        />
      ) : null}
      {view === "login" ? <AuthView type="login" onAuth={handleAuth} onGo={setView} /> : null}
      {view === "register" ? <AuthView type="register" onAuth={handleAuth} onGo={setView} /> : null}
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
          <img className="avatar" src={user.avatarUrl} alt="" onClick={() => onGo("mine")} />
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
  onDeletePost
}: {
  user: User | null;
  post: Post;
  comments: Comment[];
  onGo: (view: View) => void;
  onLike: (post: Post) => void;
  onAddComment: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteComment: (id: string) => void;
  onDeletePost: (id: string) => void;
}) {
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
              <strong>{post.author?.nickname || "匿名用户"}</strong>
              <p>{post.merchantName || "未关联商家"}</p>
            </div>
          </div>
          <h1>{post.title}</h1>
          <p>{post.content}</p>
          <div className="tags">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
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
                <strong>{comment.author?.nickname}</strong>
                <p>{comment.content}</p>
              </div>
              {user?.id === comment.authorId ? <button onClick={() => onDeleteComment(comment.id)}>删除</button> : null}
            </div>
          ))
        ) : (
          <Empty text="暂无评论" />
        )}
        <form className="comment-form" onSubmit={onAddComment}>
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
  onGo,
  onOpenPost,
  onAvatar,
  onProfile,
  onLogout
}: {
  user: User | null;
  posts: Post[];
  onGo: (view: View) => void;
  onOpenPost: (id: string) => void;
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
          <h1>{user.nickname}</h1>
          <p>{user.bio || "还没有简介"}</p>
        </div>
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

function PostCard({ post, onOpenPost }: { post: Post; onOpenPost: (id: string) => void }) {
  return (
    <article className="post-card" onClick={() => onOpenPost(post.id)}>
      <img className="post-cover" src={post.coverImageUrl} alt="" />
      <div className="post-body">
        <h3>{post.title}</h3>
        <p>{post.content}</p>
        <div className="meta">
          <span>{post.author?.nickname || "匿名用户"}</span>
          <span>
            {post.likeCount} 赞 · {post.commentCount} 评
          </span>
        </div>
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
