import { useState, useCallback, useEffect } from "react";
import { getAuth } from "../lib/cloudbase";

export default function Auth() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<unknown>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const auth = getAuth();
    auth.getLoginState().then((state) => {
      if (state) setUser(state.user);
    });
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendCode = useCallback(async () => {
    if (!/^1\d{10}$/.test(phone)) {
      setError("请输入有效的手机号");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      await auth.sendPhoneCode(phone);
      setSent(true);
      setCountdown(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const login = useCallback(async () => {
    if (code.length < 4) {
      setError("请输入验证码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      await auth.signUpWithPhoneCode(phone, code);
      const state = await auth.getLoginState();
      if (state) setUser(state.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }, [phone, code]);

  if (user) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <p>已登录</p>
        <button onClick={() => getAuth().signOut().then(() => setUser(null))}>
          退出登录
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: "4rem auto", padding: "1.5rem" }}>
      <h2>登录</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="tel"
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ padding: "0.5rem", fontSize: "1rem" }}
        />
        {!sent ? (
          <button onClick={sendCode} disabled={loading}>
            {loading ? "发送中..." : "获取验证码"}
          </button>
        ) : (
          <>
            <input
              type="text"
              placeholder="验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ padding: "0.5rem", fontSize: "1rem" }}
            />
            <button onClick={login} disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </button>
            <button onClick={sendCode} disabled={countdown > 0}>
              {countdown > 0 ? `${countdown}s 后重发` : "重新发送"}
            </button>
          </>
        )}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </div>
  );
}
