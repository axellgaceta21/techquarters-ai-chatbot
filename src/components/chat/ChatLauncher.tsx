import { useChat } from "../../hooks/useChat";
import Icon from "../ui/Icon";
export default function ChatLauncher() { const { isOpen, openChat } = useChat(); if (isOpen) return null; return <button className="chat-launcher" onClick={openChat} aria-label="Chat with TechQuarters AI"><span><Icon name="chat"/></span><b>Chat with us</b></button>; }
