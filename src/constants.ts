import type { Props } from "astro";
import IconMail from "@/assets/icons/IconMail.svg";
import { SITE } from "@/config";

interface Social {
  name: string;
  href: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
}

// 底部社交图标：仅保留邮箱
export const SOCIALS: Social[] = [
  {
    name: "Mail",
    href: "mailto:issalt777@outlook.com", // <--- 请把这里改为你自己的邮箱地址
    linkTitle: `发送邮件给 ${SITE.title}`,
    icon: IconMail,
  },
] as const;

// 文章分享图标：仅保留邮件分享
export const SHARE_LINKS: Social[] = [
  {
    name: "Mail",
    href: "mailto:?subject=See%20this%20post&body=",
    linkTitle: `通过邮件分享此文章`,
    icon: IconMail,
  },
] as const;
