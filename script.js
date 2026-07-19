(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- スクロール連動フェードイン ---- */
  var revealTargets = document.querySelectorAll(
    "main h2, .card, .hero-stats li, .skill-list li, .workflow-lead, .workflow-diagram, .workflow-note"
  );
  if (!reduceMotion && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealTargets.forEach(function (el, i) {
      el.classList.add("reveal");
      el.style.transitionDelay = (i % 3) * 80 + "ms";
      io.observe(el);
    });
  }

  /* ---- 実績数字のカウントアップ(初回表示時のみ) ---- */
  var counters = document.querySelectorAll(".count");
  if (!reduceMotion && "IntersectionObserver" in window && counters.length) {
    var countIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countIo.unobserve(entry.target);
        animateCount(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) {
      countIo.observe(el);
    });
  }

  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-target"), 10);
    if (isNaN(target)) return;
    var duration = 1200;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    el.textContent = "0";
    requestAnimationFrame(step);
  }

  /* ---- review-pipeline デモ: サンプルレビューと返信例(創作サンプル・API不使用) ---- */
  var SAMPLES = {
    positive: {
      review: "★5 ランチで利用しました。パスタが本格的で、店員さんの感じも良かったです。また行きます。",
      reply: "ご来店いただきありがとうございます。パスタをお気に召していただけたとのこと、スタッフ一同大変嬉しく拝見しました。季節ごとにメニューも入れ替えておりますので、次回のご来店も心よりお待ちしております。"
    },
    negative: {
      review: "★2 味は悪くないけど、提供までかなり待たされました。混む時間帯は覚悟が必要かも。",
      reply: "このたびは提供までお時間をいただき、申し訳ございませんでした。お昼のピーク時間帯の調理体制と席のご案内手順を見直し、お待たせしない運営に改善してまいります。貴重なご意見をありがとうございました。"
    },
    complaint: {
      review: "★1 注文したものと違う料理が出てきた上、謝罪もそっけなかった。残念です。",
      reply: "このたびはご注文のお間違いと、その際の対応でご不快な思いをおかけしましたこと、心よりお詫び申し上げます。注文確認の手順とスタッフ教育をあらためて見直し、再発防止に努めます。差し支えなければ、次の機会に挽回のチャンスをいただけますと幸いです。"
    }
  };

  var choiceButtons = document.querySelectorAll(".demo-choice");
  var reviewText = document.getElementById("demo-review-text");
  var replyBox = document.getElementById("demo-reply-box");
  var replyText = document.getElementById("demo-reply-text");
  var typingTimer = null;

  choiceButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var sample = SAMPLES[btn.getAttribute("data-review")];
      if (!sample) return;
      choiceButtons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      reviewText.textContent = sample.review;
      reviewText.hidden = false;
      replyBox.hidden = false;
      typeText(replyText, sample.reply);
    });
  });

  function typeText(el, text) {
    if (typingTimer !== null) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
    if (reduceMotion) {
      el.textContent = text;
      return;
    }
    el.textContent = "";
    el.classList.add("typing");
    var i = 0;
    typingTimer = setInterval(function () {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(typingTimer);
        typingTimer = null;
        el.classList.remove("typing");
      }
    }, 35);
  }

  /* ---- プロンプト品質チェッカー簡易版(ルールベース・全てブラウザ内) ---- */
  var checkerInput = document.getElementById("checker-input");
  var checkerPanel = document.getElementById("checker-panel");
  var checkerScore = document.getElementById("checker-score");
  var checkerMetrics = document.getElementById("checker-metrics");

  if (checkerInput) {
    checkerInput.addEventListener("input", function () {
      var text = checkerInput.value.trim();
      if (!text) {
        checkerPanel.hidden = true;
        return;
      }
      var result = evaluatePrompt(text);
      renderScore(result);
      checkerPanel.hidden = false;
    });
  }

  function evaluatePrompt(text) {
    var metrics = [];

    var len = text.length;
    metrics.push({
      name: "文字数",
      score: len >= 100 ? 20 : len >= 40 ? 12 : len >= 10 ? 5 : 0,
      max: 20,
      advice: len >= 100 ? "十分な情報量です" : "背景や条件を足すと精度が上がります"
    });

    var concreteHits = countMatches(text, [/例えば/, /具体的/, /以下の/, /条件/, /目的/, /背景/, /[0-9０-９]+/]);
    metrics.push({
      name: "具体性",
      score: Math.min(concreteHits * 7, 20),
      max: 20,
      advice: concreteHits >= 3 ? "具体的な指示ができています" : "数字・例・条件を明示すると具体性が上がります"
    });

    var structureScore = 0;
    if (/\n/.test(text)) structureScore += 5;
    if (/^\s*([-・*]|[0-9０-９]+[.．)])/m.test(text)) structureScore += 10;
    if (/^#|【.+】/m.test(text)) structureScore += 5;
    metrics.push({
      name: "構造化",
      score: structureScore,
      max: 20,
      advice: structureScore >= 15 ? "読みやすく構造化されています" : "箇条書きや見出しで整理すると伝わりやすくなります"
    });

    var hasRole = /あなたは|役割|の専門家|として(振る舞|回答|行動)/.test(text);
    metrics.push({
      name: "役割指定",
      score: hasRole ? 20 : 0,
      max: 20,
      advice: hasRole ? "役割が指定されています" : "「あなたは◯◯の専門家です」等の役割指定が有効です"
    });

    var hasFormat = /JSON|json|表形式|箇条書きで|Markdown|マークダウン|形式で|字以内|文字以内|[0-9０-９]+個/.test(text);
    metrics.push({
      name: "出力形式",
      score: hasFormat ? 20 : 0,
      max: 20,
      advice: hasFormat ? "出力形式が指定されています" : "出力の形式や分量を指定するとブレが減ります"
    });

    var total = metrics.reduce(function (sum, m) { return sum + m.score; }, 0);
    return { total: total, metrics: metrics };
  }

  function countMatches(text, patterns) {
    return patterns.reduce(function (n, re) { return n + (re.test(text) ? 1 : 0); }, 0);
  }

  function renderScore(result) {
    checkerScore.textContent = result.total;
    checkerMetrics.innerHTML = "";
    result.metrics.forEach(function (m) {
      var li = document.createElement("li");
      var status = document.createElement("span");
      status.className = "metric-status " + (m.score >= m.max * 0.75 ? "ok" : m.score > 0 ? "warn" : "ng");
      status.textContent = m.name + " " + m.score + "/" + m.max;
      var advice = document.createElement("span");
      advice.className = "metric-advice";
      advice.textContent = m.advice;
      li.appendChild(status);
      li.appendChild(advice);
      checkerMetrics.appendChild(li);
    });
  }
})();
