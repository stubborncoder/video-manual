"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { User, Mail, Palette, Sun, Moon, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/authStore";
import { useLocale } from "@/components/providers/I18nProvider";
import { usePalette, Palette as PaletteType } from "@/components/providers/ThemeProvider";
import { locales, localeNames, Locale } from "@/lib/i18n";

const palettes: { value: PaletteType; label: string; color: string }[] = [
  { value: "electric-blue", label: "Electric Blue", color: "#2563eb" },
  { value: "coral", label: "Coral", color: "#f97316" },
  { value: "mint", label: "Mint", color: "#10b981" },
  { value: "marigold", label: "Marigold", color: "#eab308" },
  { value: "grape", label: "Grape", color: "#8b5cf6" },
];

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tSidebar = useTranslations("sidebar");
  const { user } = useAuthStore();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();

  // Get user info from Supabase user object
  const email = user?.email || "";
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || email.split("@")[0] || "";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";

  // Get initials for avatar fallback
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
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
          <CardContent className="space-y-4">
            {/* Language */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {tSidebar("language")}
              </Label>
              <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {localeNames[loc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Theme */}
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {tSidebar("darkMode")}
              </Label>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>

            {/* Color Palette */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t("colorPalette")}
              </Label>
              <Select value={palette} onValueChange={(value) => setPalette(value as PaletteType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {palettes.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
