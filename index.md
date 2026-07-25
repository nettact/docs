---
# 两种语言各自住在 /zh/ 与 /en/,根路径只是个落地页:meta refresh 立刻转到中文版
# (静态托管上无需 JS 即可生效),同时留一组可见链接给不跟随跳转的场景。
# noindex 是为了不让搜索引擎把这个跳转页当成 / 的正文内容收录。
layout: false
title: NetTact
head:
  - - meta
    - http-equiv: refresh
      content: 0; url=/zh/
  - - meta
    - name: robots
      content: noindex
---

<div style="max-width:32rem;margin:20vh auto;padding:0 1.5rem;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;line-height:1.7">
  <h1 style="font-size:1.75rem;font-weight:600;margin:0 0 .75rem">NetTact</h1>
  <p style="margin:0 0 1.5rem;opacity:.7">正在前往中文文档…<br>Redirecting to the documentation…</p>
  <p style="margin:0"><a href="/zh/">简体中文</a> &nbsp;·&nbsp; <a href="/en/">English</a></p>
</div>
