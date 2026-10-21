import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Pick from gallery, crop 4:5 (or free for chat), downscale to 1080px JPEG so uploads stay small on 4G. */
export async function pickAndShrink(crop = true): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: crop, aspect: crop ? [4, 5] : undefined, quality: 1 });
  if (r.canceled) return null;
  const ctx = ImageManipulator.manipulate(r.assets[0].uri);
  ctx.resize({ width: 1080, height: null });
  const img = await ctx.renderAsync();
  return (await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })).uri;
}
