import { useState } from "react";
import { faqs } from "../../data/siteData";
import Icon from "../ui/Icon";
export default function FAQ() { const [open, setOpen] = useState(0); return <div className="faq-list">{faqs.map(([question, answer], index) => <div className={`faq-item ${open === index ? "open" : ""}`} key={question}><button onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}><span>{question}</span><Icon name={open === index ? "minus" : "plus"}/></button><div className="faq-answer"><p>{answer}</p></div></div>)}</div>; }
