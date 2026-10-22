import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Pick from gallery, center-crop 4:5 (or free for chat), downscale to 1080px JPEG so uploads stay small on 4G.
 *  No native crop screen: Android's crop UI varies per OEM and users miss its confirm button. */
export async function pickAndShrink(crop = true): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (r.canceled) return null;
  const { uri, width: w, height: h } = r.assets[0];
  const ctx = ImageManipulator.manipulate(uri);
  if (crop && w && h) {
    const cw = Math.min(w, Math.round((h * 4) / 5));
    const ch = Math.min(h, Math.round((w * 5) / 4));
    ctx.crop({ originX: Math.round((w - cw) / 2), originY: Math.round((h - ch) / 2), width: cw, height: ch });
  }
  ctx.resize({ width: 1080, height: null });
  const img = await ctx.renderAsync();
  return (await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })).uri;
}
