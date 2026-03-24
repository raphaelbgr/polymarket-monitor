"""Trading Agent — manages paper/live BTC perp positions based on predictions."""

from __future__ import annotations

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.run import RunContext

from agents.config import TRADING_MODEL, TRADING_MODE
from agents.tools.paper_trading import paper_trader


def _parse_model_id(model_str: str) -> str:
    return model_str.split(":", 1)[1] if ":" in model_str else model_str


async def open_position(
    run_context: RunContext,
    side: str,
    size_usd: str,
    reasoning: str,
) -> str:
    """Open a paper BTC perp position.

    Args:
        side: "long" or "short"
        size_usd: position size in USD (as string)
        reasoning: brief reasoning for the trade
    """
    session_id = run_context.session_state.get("session_id", "default")
    prediction = run_context.session_state.get("latest_prediction", {})
    entry_price = prediction.get("current_price", 0)
    pred_id = prediction.get("id", "")

    if entry_price <= 0:
        return "Cannot open position: no current price available"

    pos = paper_trader.open_position(
        session_id=session_id,
        side=side,
        size_usd=float(size_usd),
        entry_price=entry_price,
        prediction_id=pred_id,
        reasoning=reasoning,
    )

    run_context.session_state["open_positions"] = len(paper_trader.get_open_positions(session_id))
    run_context.session_state["total_balance"] = paper_trader.get_balance(session_id)

    return (
        f"{'[PAPER] ' if TRADING_MODE == 'paper' else ''}Position opened:\n"
        f"- ID: {pos.id}\n"
        f"- Side: {side.upper()}\n"
        f"- Size: ${float(size_usd):,.0f}\n"
        f"- Entry: ${entry_price:,.2f}\n"
        f"- Reasoning: {reasoning}"
    )


async def close_position(
    run_context: RunContext,
    position_id: str,
    reasoning: str,
) -> str:
    """Close an open paper position.

    Args:
        position_id: ID of the position to close
        reasoning: brief reasoning for closing
    """
    session_id = run_context.session_state.get("session_id", "default")
    prediction = run_context.session_state.get("latest_prediction", {})
    exit_price = prediction.get("current_price", 0)

    if exit_price <= 0:
        return "Cannot close position: no current price available"

    pos = paper_trader.close_position(session_id, position_id, exit_price)
    if not pos:
        return f"Position {position_id} not found or already closed"

    run_context.session_state["open_positions"] = len(paper_trader.get_open_positions(session_id))
    run_context.session_state["total_balance"] = paper_trader.get_balance(session_id)

    pnl_sign = "+" if pos.pnl >= 0 else ""
    return (
        f"{'[PAPER] ' if TRADING_MODE == 'paper' else ''}Position closed:\n"
        f"- ID: {pos.id}\n"
        f"- Side: {pos.side.upper()}\n"
        f"- Entry: ${pos.entry_price:,.2f} → Exit: ${exit_price:,.2f}\n"
        f"- PnL: {pnl_sign}${pos.pnl:,.2f} ({pnl_sign}{pos.pnl_pct:.1f}%)\n"
        f"- Reasoning: {reasoning}"
    )


async def get_portfolio(run_context: RunContext) -> str:
    """Get current portfolio status including open positions and balance."""
    session_id = run_context.session_state.get("session_id", "default")
    positions = paper_trader.get_open_positions(session_id)
    balance = paper_trader.get_balance(session_id)
    total_pnl = paper_trader.get_total_pnl(session_id)

    if not positions:
        return f"No open positions. Balance: ${balance:,.2f}, Total realized PnL: ${total_pnl:,.2f}"

    lines = [f"Portfolio ({TRADING_MODE} mode):"]
    for p in positions:
        pnl_sign = "+" if p.pnl >= 0 else ""
        lines.append(
            f"  - {p.side.upper()} ${p.size_usd:,.0f} @ ${p.entry_price:,.2f} "
            f"→ ${p.current_price:,.2f} ({pnl_sign}${p.pnl:,.2f})"
        )
    lines.append(f"Balance: ${balance:,.2f} | Realized PnL: ${total_pnl:,.2f}")
    return "\n".join(lines)


def create_trading_agent() -> Agent:
    """Create the trading agent."""
    model_id = _parse_model_id(TRADING_MODEL)

    return Agent(
        name="Trading",
        model=OpenAIChat(id=model_id),
        tools=[open_position, close_position, get_portfolio],
        session_state={
            "session_id": "default",
            "latest_prediction": None,
            "open_positions": 0,
            "total_balance": 10_000.0,
        },
        instructions=(
            f"You are a BTC perpetual futures trading agent operating in {TRADING_MODE.upper()} mode.\n\n"
            "Rules:\n"
            "1. Only trade based on predictions with confidence >= 0.6\n"
            "2. Max position size: $1,000 (paper) or $100 (live)\n"
            "3. Close existing positions before opening opposite direction\n"
            "4. If prediction is neutral or low confidence, do nothing\n"
            "5. Always check portfolio first before opening new positions\n\n"
            "When given a prediction:\n"
            "1. Call get_portfolio to see current state\n"
            "2. Decide whether to open/close/hold\n"
            "3. Execute via open_position or close_position\n\n"
            "Current prediction: {latest_prediction}\n"
            "Open positions: {open_positions}\n"
            "Balance: ${total_balance}"
        ),
        markdown=True,
    )
