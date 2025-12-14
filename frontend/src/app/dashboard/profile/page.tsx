"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { User, Mail, Palette, Sun, Moon, Globe, ChevronDown } from "lucide-react";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";
import { useLocale } from "@/components/providers/I18nProvider";
import { usePalette, Palette as PaletteType } from "@/components/providers/ThemeProvider";
import { locales, localeNames, Locale } from "@/lib/i18n";
import { getInitials } from "@/lib/utils";

const palettes: { value: PaletteType; label: string; colorClass: string }[] = [
  { value: "electric-blue", label: "Electric Blue", colorClass: "bg-blue-600" },
  { value: "coral", label: "Coral", colorClass: "bg-orange-500" },
  { value: "mint", label: "Mint", colorClass: "bg-emerald-500" },
  { value: "marigold", label: "Marigold", colorClass: "bg-yellow-500" },
  { value: "grape", label: "Grape", colorClass: "bg-violet-500" },
];

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tSidebar = useTranslations("sidebar");
  const { user } = useAuthStore();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch with theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get user info from Supabase user object
  const email = user?.email || "";
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || email.split("@")[0] || "";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
  const initials = getInitials(displayName);

  // Get current palette info
  const currentPalette = palettes.find(p => p.value === palette) || palettes[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex gap-3">
        <SidebarToggle className="mt-1.5 shrink-0" />
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-semibold">{displayName}</h2>
              <p className="text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("accountInfo")}
            </CardTitle>
            <CardDescription>{t("accountInfoDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("displayName")}</Label>
              <Input
                id="displayName"
                value={displayName}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t("preferences")}
            </CardTitle>
            <CardDescription>{t("preferencesDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language */}
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {tSidebar("language")}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-between">
                    {localeNames[locale]}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[140px]">
                  <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as Locale)}>
                    {locales.map((loc) => (
                      <DropdownMenuRadioItem key={loc} value={loc}>
                        {localeNames[loc]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Theme */}
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                {mounted && theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {t("theme")}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-between">
                    <span className="flex items-center gap-2">
                      {mounted && theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      {mounted ? (theme === "dark" ? t("darkMode") : t("lightMode")) : t("lightMode")}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[140px]">
                  <DropdownMenuRadioGroup value={mounted ? theme || "light" : "light"} onValueChange={setTheme}>
                    <DropdownMenuRadioItem value="light">
                      <Sun className="h-4 w-4 mr-2" />
                      {t("lightMode")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <Moon className="h-4 w-4 mr-2" />
                      {t("darkMode")}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Color Palette */}
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t("colorPalette")}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[160px] justify-between">
                    <span className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full ${currentPalette.colorClass}`} />
                      {currentPalette.label}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px]">
                  <DropdownMenuRadioGroup value={palette} onValueChange={(value) => setPalette(value as PaletteType)}>
                    {palettes.map((p) => (
                      <DropdownMenuRadioItem key={p.value} value={p.value}>
                        <div className={`h-4 w-4 rounded-full mr-2 ${p.colorClass}`} />
                        {p.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
