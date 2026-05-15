import axios from "axios";

const HUGGINGFACE_API_URL =
  process.env.HUGGINGFACE_API_URL || "https://router.huggingface.co/hf-inference/models";
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const SENTIMENT_MODEL =
  process.env.SENTIMENT_MODEL || "nlptown/bert-base-multilingual-uncased-sentiment";
const COMMENT_TRUST_MODEL = process.env.COMMENT_TRUST_MODEL || SENTIMENT_MODEL;

const SPAM_KEYWORDS = [
  "太好了", "非常棒", "超级好吃", "无敌美味", "绝绝子", "YYDS", 
  "强烈推荐", "必点", "绝了", "完美", "特别好", "超级赞",
  "太好吃了", "真的好吃", "好吃到爆", "好吃不贵", "性价比高",
  "服务好", "环境好", "干净卫生", "分量足", "价格实惠"
];

const SUSPICIOUS_PATTERNS = [
  /[！!]{2,}/g,
  /[。.]{3,}/g,
  /[～~]{2,}/g,
  /[👍❤️🔥🎉]{3,}/g,
];

export type AIVerificationResult = "verified" | "suspicious" | "fake";
export type CommentCredibilityLabel = "high" | "medium" | "low";

export interface CommentCredibilityResult {
  score: number;
  label: CommentCredibilityLabel;
  reason: string;
  model: string;
  modelLabel?: string;
  modelConfidence?: number;
}

export interface AIDetectionResult {
  result: AIVerificationResult;
  confidence: number;
  reason?: string;
  credibility?: CommentCredibilityResult;
}

function logHuggingFaceFallback(message: string, error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const detail =
      typeof responseData === "string"
        ? responseData.replace(/\s+/g, " ").slice(0, 160)
        : responseData && typeof responseData === "object"
          ? JSON.stringify(responseData).slice(0, 160)
          : undefined;

    console.warn(message, {
      code: error.code,
      status: error.response?.status,
      detail
    });
    return;
  }

  console.warn(message, error instanceof Error ? error.message : error);
}

const FOOD_KEYWORDS = [
  "餐厅", "饭店", "餐馆", "小吃", "美食", "菜品", "菜", "饭", "面", 
  "火锅", "烧烤", "奶茶", "咖啡", "甜品", "蛋糕", "面包", "点心",
  "厨房", "后厨", "后厨环境", "卫生", "食材", "新鲜", "味道", "口感",
  "菜单", "价格", "服务", "环境", "装修", "座位", "排队", "人气",
  "探店", "打卡", "评价", "推荐", "踩雷", "避雷", "必点", "招牌",
  "外卖", "堂食", "打包", "团购", "优惠", "套餐", "折扣"
];

const ALLOWED_TASKS = [
  "后厨", "厨房", "卫生", "环境", "食材", "菜品", "实物", "菜单",
  "招牌菜", "分量", "价格", "服务", "排队", "人气", "评价"
];

export class AIDetector {
  private modelCache = new Map<string, number>();

  private toCredibilityLabel(score: number): CommentCredibilityLabel {
    if (score >= 80) return "high";
    if (score >= 55) return "medium";
    return "low";
  }

  private normalizeScore(score: number) {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private parseClassificationResponse(data: unknown): Array<{ label: string; score: number }> {
    if (!Array.isArray(data)) return [];
    const predictions = Array.isArray(data[0]) ? data[0] : data;
    return predictions
      .filter((item): item is { label: string; score: number } => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        return typeof candidate.label === "string" && typeof candidate.score === "number";
      })
      .sort((left, right) => right.score - left.score);
  }

  private localCredibilityScore(text: string, spamResult: AIDetectionResult) {
    let score = 62;
    const length = text.trim().length;
    const hasFoodContext = FOOD_KEYWORDS.some((keyword) => text.includes(keyword));
    const hasSpecificDetail = [
      "排队", "价格", "分量", "服务", "环境", "口感", "新鲜", "上菜", "堂食",
      "外卖", "套餐", "人均", "菜单", "座位", "卫生", "复购", "踩雷"
    ].some((keyword) => text.includes(keyword));

    if (length >= 30) score += 10;
    if (length >= 80) score += 8;
    if (hasFoodContext) score += 8;
    if (hasSpecificDetail) score += 8;
    if (spamResult.result === "suspicious") score -= 18;
    if (spamResult.result === "fake") score -= 40;
    if (SPAM_KEYWORDS.filter((keyword) => text.includes(keyword)).length >= 3) score -= 12;

    return this.normalizeScore(score);
  }

  async assessCommentCredibility(text: string, spamResult?: AIDetectionResult): Promise<CommentCredibilityResult> {
    const baseline = spamResult ?? await this.detectSpamText(text);
    const fallbackScore = this.localCredibilityScore(text, baseline);
    const fallbackReason = baseline.reason || "基于评论长度、餐饮细节和刷评特征综合评估";

    if (!HUGGINGFACE_API_KEY) {
      return {
        score: fallbackScore,
        label: this.toCredibilityLabel(fallbackScore),
        reason: fallbackReason,
        model: "local-fallback"
      };
    }

    try {
      const response = await axios.post(
        `${HUGGINGFACE_API_URL}/${COMMENT_TRUST_MODEL}`,
        { inputs: text, parameters: { top_k: 3 } },
        {
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const predictions = this.parseClassificationResponse(response.data);
      const topPrediction = predictions[0];

      if (topPrediction) {
        const modelSignal = 50 + (topPrediction.score - 0.5) * 60;
        const score = this.normalizeScore(modelSignal * 0.55 + fallbackScore * 0.45);
        return {
          score,
          label: this.toCredibilityLabel(score),
          reason: `${COMMENT_TRUST_MODEL}分类置信度${Math.round(topPrediction.score * 100)}%，${fallbackReason}`,
          model: COMMENT_TRUST_MODEL,
          modelLabel: topPrediction.label,
          modelConfidence: topPrediction.score
        };
      }
    } catch (error) {
      logHuggingFaceFallback("Comment credibility model failed, using fallback", error);
    }

    return {
      score: fallbackScore,
      label: this.toCredibilityLabel(fallbackScore),
      reason: fallbackReason,
      model: "local-fallback"
    };
  }

  async analyzeBountyContent(description: string, merchantName: string): Promise<AIDetectionResult> {
    const text = description.toLowerCase().trim();
    
    if (text.length < 10) {
      return { result: "suspicious", confidence: 0.7, reason: "悬赏内容过短" };
    }
    
    if (text.length > 500) {
      return { result: "suspicious", confidence: 0.6, reason: "悬赏内容过长" };
    }
    
    let foodScore = 0;
    FOOD_KEYWORDS.forEach(keyword => {
      if (text.includes(keyword) || merchantName.includes(keyword)) {
        foodScore++;
      }
    });
    
    let taskScore = 0;
    ALLOWED_TASKS.forEach(task => {
      if (text.includes(task)) {
        taskScore++;
      }
    });
    
    const suspiciousKeywords = ["投票", "点赞", "关注", "转发", "下载", "注册", "邀请", 
                                "广告", "推广", "刷单", "返利", "红包", "抽奖", "游戏"];
    let suspiciousCount = 0;
    suspiciousKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        suspiciousCount++;
      }
    });
    
    if (suspiciousCount >= 1) {
      return { result: "fake", confidence: 0.9, reason: "包含违规内容关键词" };
    }
    
    if (foodScore === 0 && taskScore === 0) {
      return { result: "fake", confidence: 0.85, reason: "内容与美食/餐饮无关" };
    }
    
    if (taskScore === 0) {
      return { result: "suspicious", confidence: 0.7, reason: "未明确考察任务类型" };
    }
    
    if (foodScore >= 2 && taskScore >= 1) {
      return { result: "verified", confidence: 0.9 };
    }
    
    if (foodScore >= 1 && taskScore >= 1) {
      return { result: "verified", confidence: 0.8 };
    }
    
    return { result: "suspicious", confidence: 0.65, reason: "内容相关性较低，建议明确考察内容" };
  }

  async detectSpamText(text: string): Promise<AIDetectionResult> {
    const textLength = text.length;
    
    if (textLength < 8) {
      return { result: "suspicious", confidence: 0.7, reason: "内容过短" };
    }
    
    if (textLength > 800) {
      return { result: "suspicious", confidence: 0.6, reason: "内容过长" };
    }
    
    let spamScore = 0;
    let normalScore = 0;
    
    SPAM_KEYWORDS.forEach(keyword => {
      if (text.includes(keyword)) {
        spamScore++;
      }
    });
    
    const negativeWords = ["味道一般", "还可以", "价格贵", "服务差", "等了很久", "分量少", "不好吃", "失望"];
    negativeWords.forEach(word => {
      if (text.includes(word)) {
        normalScore++;
      }
    });
    
    let patternCount = 0;
    SUSPICIOUS_PATTERNS.forEach(pattern => {
      if (pattern.test(text)) {
        patternCount++;
      }
    });
    
    if (patternCount >= 2) {
      return { result: "fake", confidence: 0.85, reason: "存在多个可疑格式模式" };
    }
    
    if (spamScore >= 4) {
      return { result: "fake", confidence: 0.9, reason: "包含过多赞美关键词" };
    }
    
    if (spamScore >= 3 && normalScore === 0) {
      return { result: "fake", confidence: 0.85, reason: "过度正面评价且无负面词汇" };
    }
    
    if (spamScore >= 2 && textLength < 30) {
      return { result: "suspicious", confidence: 0.75, reason: "简短内容包含多个赞美词" };
    }
    
    const result = await this.classifySentiment(text);
    
    if (result.label === "positive" && result.score > 0.95 && spamScore >= 2) {
      return { result: "suspicious", confidence: 0.8, reason: "极端正面情绪且包含赞美关键词" };
    }
    
    if (result.label === "negative" && normalScore === 0 && textLength < 20) {
      return { result: "suspicious", confidence: 0.7, reason: "负面评价过于简短" };
    }
    
    return { result: "verified", confidence: 0.85 };
  }

  async classifySentiment(text: string): Promise<{ label: string; score: number }> {
    if (!HUGGINGFACE_API_KEY) {
      return this.fallbackSentimentAnalysis(text);
    }

    try {
      const response = await axios.post(
        `${HUGGINGFACE_API_URL}/${SENTIMENT_MODEL}`,
        { inputs: text, parameters: { top_k: 5 } },
        {
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      const predictions = this.parseClassificationResponse(response.data);
      const topPrediction = predictions[0];

      if (topPrediction) {
        const normalizedLabel = topPrediction.label.toLowerCase();
        let label = "neutral";
        if (normalizedLabel.includes("negative") || normalizedLabel.includes("1") || normalizedLabel.includes("2")) {
          label = "negative";
        } else if (normalizedLabel.includes("positive") || normalizedLabel.includes("4") || normalizedLabel.includes("5")) {
          label = "positive";
        }

        return { label, score: topPrediction.score };
      }
    } catch (error) {
      logHuggingFaceFallback("Hugging Face API failed, using fallback", error);
    }

    return this.fallbackSentimentAnalysis(text);
  }

  private fallbackSentimentAnalysis(text: string): { label: string; score: number } {
    const positiveWords = ["好", "棒", "赞", "美", "香", "鲜", "嫩", "甜", "爽", "满意"];
    const negativeWords = ["差", "烂", "糟", "臭", "酸", "咸", "苦", "糊", "贵", "慢"];
    
    let posCount = 0;
    let negCount = 0;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) posCount++;
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) negCount++;
    });
    
    let label = "neutral";
    let score = 0.5;
    
    if (posCount > negCount * 2) {
      label = "positive";
      score = Math.min(0.95, 0.5 + posCount * 0.1);
    } else if (negCount > posCount * 2) {
      label = "negative";
      score = Math.min(0.95, 0.5 + negCount * 0.1);
    }
    
    return { label, score };
  }

  async analyzeComment(comment: string): Promise<AIDetectionResult> {
    const result = await this.detectSpamText(comment);
    const credibility = await this.assessCommentCredibility(comment, result);
    
    if (result.result === "verified") {
      const sentiment = await this.classifySentiment(comment);
      
      if (sentiment.label === "positive" && sentiment.score > 0.98) {
        return { result: "suspicious", confidence: 0.75, reason: "极端正面情绪", credibility };
      }

      if (credibility.score < 45) {
        return { result: "suspicious", confidence: 0.72, reason: credibility.reason, credibility };
      }
    }
    
    return { ...result, credibility };
  }

  async detectImageAuthenticity(imageDataUrl: string): Promise<AIDetectionResult> {
    if (!HUGGINGFACE_API_KEY) {
      return this.fallbackImageDetection();
    }

    try {
      const base64Data = imageDataUrl.split(",")[1];
      const response = await axios.post(
        `${HUGGINGFACE_API_URL}/Xenova/vit-base-patch16-224`,
        { inputs: base64Data },
        {
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      if (response.data && Array.isArray(response.data)) {
        const predictions = response.data[0];
        const maxPrediction = predictions.reduce((prev: any, curr: any) => 
          curr.score > prev.score ? curr : prev
        );

        const suspiciousCategories = ["screen", "monitor", "television", "text", "document"];
        const isSuspicious = suspiciousCategories.some(cat => 
          maxPrediction.label.toLowerCase().includes(cat)
        );

        if (isSuspicious && maxPrediction.score > 0.5) {
          return { 
            result: "fake", 
            confidence: maxPrediction.score, 
            reason: `图片内容疑似${maxPrediction.label}` 
          };
        }
      }
    } catch (error) {
      logHuggingFaceFallback("Image detection API failed, using fallback", error);
    }

    return this.fallbackImageDetection();
  }

  private fallbackImageDetection(): AIDetectionResult {
    return { result: "verified", confidence: 0.85, reason: "本地演示模式自动通过" };
  }

  async batchDetect(contents: string[]): Promise<AIDetectionResult[]> {
    return Promise.all(contents.map(content => this.detectSpamText(content)));
  }
}

export const aiDetector = new AIDetector();
